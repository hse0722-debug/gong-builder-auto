import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36';

async function getText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

function clean(s = '') {
  return String(s).toLowerCase().replace(/\s+/g, '').replace(/[^\w가-힣]/g, '');
}

function score(query, title, artist) {
  const q = clean(query);
  const text = clean(`${artist} ${title}`);
  let n = 0;

  for (const word of query.split(/\s+/).filter(Boolean)) {
    if (text.includes(clean(word))) n += 10;
  }

  if (text.includes(q)) n += 50;
  return n;
}

function uniqueById(list) {
  const map = new Map();
  list.forEach(item => {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  });
  return [...map.values()].slice(0, 10);
}

async function searchMelon(q) {
  try {
    const html = await getText(`https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(q)}`);
    const $ = cheerio.load(html);
    const list = [];

    $('tr').each((_, tr) => {
      const rowHtml = $.html(tr);
      const id =
        rowHtml.match(/songId=(\d+)/)?.[1] ||
        rowHtml.match(/playSong\(['"]?\d+['"]?,\s*['"]?(\d+)['"]?\)/)?.[1];

      if (!id) return;

      const title = $(tr).find('.fc_gray, .ellipsis.rank01 a, .ellipsis a').first().text().trim() || $(tr).text().trim();
      const artist = $(tr).find('.checkEllipsis, .ellipsis.rank02 a').first().text().trim();

      list.push({
        site: 'melon',
        id,
        title,
        artist,
        url: `https://www.melon.com/song/detail.htm?songId=${id}`,
        score: score(q, title, artist)
      });
    });

    return uniqueById(list).sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function searchGenie(q) {
  try {
    const html = await getText(`https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(q)}`);
    const $ = cheerio.load(html);
    const list = [];

    $('tr').each((_, tr) => {
      const rowHtml = $.html(tr);
      const id =
        $(tr).attr('songid') ||
        $(tr).find('[songid]').first().attr('songid') ||
        rowHtml.match(/xgnm=(\d+)/)?.[1] ||
        rowHtml.match(/fnPlaySong\(['"]?(\d+)['"]?/)?.[1];

      if (!id) return;

      const title = $(tr).find('.title, .info .title').first().text().replace('TITLE', '').trim() || $(tr).text().trim();
      const artist = $(tr).find('.artist').first().text().trim();

      list.push({
        site: 'genie',
        id,
        title,
        artist,
        url: `https://www.genie.co.kr/detail/songInfo?xgnm=${id}`,
        score: score(q, title, artist)
      });
    });

    return uniqueById(list).sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function searchBugs(q) {
  try {
    const html = await getText(`https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(q)}`);
    const $ = cheerio.load(html);
    const list = [];

    $('tr').each((_, tr) => {
      const rowHtml = $.html(tr);
      const id =
        $(tr).attr('data-trackid') ||
        rowHtml.match(/track\/(\d+)/)?.[1] ||
        rowHtml.match(/trackId=(\d+)/)?.[1];

      if (!id) return;

      const title = $(tr).find('.title a').first().text().trim() || $(tr).text().trim();
      const artist = $(tr).find('.artist a').first().text().trim();

      list.push({
        site: 'bugs',
        id,
        title,
        artist,
        url: `https://music.bugs.co.kr/track/${id}`,
        score: score(q, title, artist)
      });
    });

    return uniqueById(list).sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function searchVibe(q) {
  try {
    const html = await getText(`https://vibe.naver.com/search?query=${encodeURIComponent(q)}`);
    const list = [];
    const matches = [...html.matchAll(/track\/(\d+)/g)];

    matches.forEach(m => {
      list.push({
        site: 'vibe',
        id: m[1],
        title: 'VIBE 검색결과',
        artist: '',
        url: `https://vibe.naver.com/track/${m[1]}`,
        score: 1
      });
    });

    return uniqueById(list);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: '검색어가 없습니다.' });

  const [melon, genie, bugs, vibe] = await Promise.all([
    searchMelon(q),
    searchGenie(q),
    searchBugs(q),
    searchVibe(q)
  ]);

  res.status(200).json({
    query: q,
    candidates: {
      melon,
      genie,
      bugs,
      vibe,
      youtube: []
    }
  });
}
