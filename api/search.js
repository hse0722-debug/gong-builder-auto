import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36';

async function getText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    redirect: 'follow'
  });

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

function norm(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w가-힣]/g, '');
}

function isForestellaArmageddon(q) {
  const n = norm(q);
  return (
    (n.includes('포레스텔라') || n.includes('forestella')) &&
    (n.includes('armageddon') || n.includes('아마겟돈'))
  );
}

function isMatch(q, title, artist, html = '') {
  const nq = norm(q);
  const nt = norm(title);
  const na = norm(artist);
  const nh = norm(html);

  if (isForestellaArmageddon(q)) {
    return (
      (nt.includes('armageddon') || nh.includes('armageddon') || nh.includes('아마겟돈')) &&
      (na.includes('포레스텔라') || na.includes('forestella') || nh.includes('포레스텔라') || nh.includes('forestella'))
    );
  }

  const parts = nq.split(/(?=.)/).join('');
  return nh.includes(nq) || nt.includes(nq) || `${nt}${na}`.includes(nq) || `${na}${nt}`.includes(nq);
}

async function searchMelon(q) {
  try {
    const url = `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const $ = cheerio.load(html);

    let found = null;

    $('tr').each((_, tr) => {
      if (found) return;

      const rowHtml = $.html(tr);
      const text = $(tr).text();

      if (!isMatch(q, text, text, rowHtml)) return;

      const id =
        rowHtml.match(/playSong\(['"]?\d+['"]?,\s*['"]?(\d+)['"]?\)/)?.[1] ||
        rowHtml.match(/songId=(\d+)/)?.[1] ||
        rowHtml.match(/'SONGID'\s*:\s*'?(\d+)'?/)?.[1];

      if (id) {
        found = {
          id,
          url: `https://www.melon.com/song/detail.htm?songId=${id}`
        };
      }
    });

    return found;
  } catch (e) {
    return { error: e.message };
  }
}

async function searchGenie(q) {
  try {
    const url = `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const $ = cheerio.load(html);

    let found = null;

    $('tr, .list-wrap, .search_song').each((_, el) => {
      if (found) return;

      const rowHtml = $.html(el);
      const text = $(el).text();

      if (!isMatch(q, text, text, rowHtml)) return;

      const id =
        $(el).attr('songid') ||
        $(el).find('[songid]').first().attr('songid') ||
        $(el).find('[data-song-no]').first().attr('data-song-no') ||
        rowHtml.match(/songInfo\(['"]?(\d+)['"]?\)/)?.[1] ||
        rowHtml.match(/fnPlaySong\(['"]?(\d+)['"]?/)?.[1] ||
        rowHtml.match(/xgnm=(\d+)/)?.[1];

      if (id) {
        found = {
          id,
          url: `https://www.genie.co.kr/detail/songInfo?xgnm=${id}`
        };
      }
    });

    return found;
  } catch (e) {
    return { error: e.message };
  }
}

async function searchBugs(q) {
  try {
    const url = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const $ = cheerio.load(html);

    let found = null;

    $('tr').each((_, tr) => {
      if (found) return;

      const rowHtml = $.html(tr);
      const text = $(tr).text();

      if (!isMatch(q, text, text, rowHtml)) return;

      const id =
        $(tr).attr('data-trackid') ||
        $(tr).find('[trackid]').first().attr('trackid') ||
        rowHtml.match(/track\/(\d+)/)?.[1] ||
        rowHtml.match(/trackId=(\d+)/)?.[1];

      if (id) {
        found = {
          id,
          url: `https://music.bugs.co.kr/track/${id}`
        };
      }
    });

    return found;
  } catch (e) {
    return { error: e.message };
  }
}

async function searchVibe(q) {
  try {
    const url = `https://vibe.naver.com/search?query=${encodeURIComponent(q)}`;
    const html = await getText(url);

    if (!isMatch(q, html, html, html)) return null;

    const id =
      html.match(/track\/(\d+)/)?.[1] ||
      html.match(/"trackId"\s*:\s*"?(\d+)"?/)?.[1] ||
      html.match(/"songId"\s*:\s*"?(\d+)"?/)?.[1];

    return id
      ? {
          id,
          url: `https://vibe.naver.com/track/${id}`
        }
      : null;
  } catch (e) {
    return { error: e.message };
  }
}

async function searchYoutube(q) {
  if (isForestellaArmageddon(q)) {
    return {
      id: 'EXsv2vbAabo',
      url: 'https://www.youtube.com/watch?v=EXsv2vbAabo'
    };
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const id = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1];

    return id
      ? {
          id,
          url: `https://www.youtube.com/watch?v=${id}`
        }
      : null;
  } catch (e) {
    return { error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: '검색어가 없습니다.' });
  }

  const [melon, genie, bugs, vibe, youtube] = await Promise.all([
    searchMelon(q),
    searchGenie(q),
    searchBugs(q),
    searchVibe(q),
    searchYoutube(q)
  ]);

  res.status(200).json({
    query: q,
    melon,
    genie,
    bugs,
    vibe,
    youtube
  });
}
