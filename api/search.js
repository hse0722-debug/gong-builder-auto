import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36';

async function getText(url, referer = '') {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      ...(referer ? { referer } : {})
    },
    redirect: 'follow'
  });

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

function clean(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w가-힣]/g, '');
}

function getScore(q, artist, title) {
  const query = clean(q);
  const target = clean(`${artist}${title}`);

  let score = 0;

  if (target.includes(query)) score += 100;

  q.split(/\s+/).forEach(word => {
    if (word && target.includes(clean(word))) score += 20;
  });

  return score;
}

function addResult(list, item) {
  const key = clean(`${item.artist}${item.title}`);
  const found = list.find(x => clean(`${x.artist}${x.title}`) === key);

  if (found) {
    if (item.melon) found.melon = item.melon;
    if (item.genie) found.genie = item.genie;
    if (item.bugs) found.bugs = item.bugs;
    if (item.vibe) found.vibe = item.vibe;
    found.score += item.score || 0;
  } else {
    list.push(item);
  }
}

async function searchMelon(q) {
  const list = [];

  try {
    const url = `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(q)}`;
    const html = await getText(url, 'https://www.melon.com/');
    const $ = cheerio.load(html);

    $('tr').each((_, tr) => {
      const rowHtml = $.html(tr);

      const id =
        rowHtml.match(/songId=(\d+)/)?.[1] ||
        rowHtml.match(/playSong\(['"]?\d+['"]?,\s*['"]?(\d+)['"]?\)/)?.[1];

      if (!id) return;

      const title =
        $(tr).find('.ellipsis.rank01 a').first().text().trim() ||
        $(tr).find('a[href*="songId"]').first().text().trim();

      const artist =
        $(tr).find('.ellipsis.rank02 a').first().text().trim() ||
        $(tr).find('.checkEllipsis').first().text().trim();

      if (!title) return;

      list.push({
        artist,
        title,
        melon: id,
        genie: '',
        bugs: '',
        vibe: '',
        score: getScore(q, artist, title)
      });
    });
  } catch {}

  return list;
}

async function searchGenie(q) {
  const list = [];

  try {
    const url = `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(q)}`;
    const html = await getText(url, 'https://www.genie.co.kr/');
    const $ = cheerio.load(html);

    $('tr').each((_, tr) => {
      const rowHtml = $.html(tr);

      const id =
        $(tr).attr('songid') ||
        $(tr).find('[songid]').first().attr('songid') ||
        rowHtml.match(/xgnm=(\d+)/)?.[1] ||
        rowHtml.match(/fnPlaySong\(['"]?(\d+)['"]?/)?.[1];

      if (!id) return;

      const title = $(tr)
        .find('.title')
        .first()
        .text()
        .replace('TITLE', '')
        .trim();

      const artist = $(tr).find('.artist').first().text().trim();

      if (!title) return;

      list.push({
        artist,
        title,
        melon: '',
        genie: id,
        bugs: '',
        vibe: '',
        score: getScore(q, artist, title)
      });
    });
  } catch {}

  return list;
}

async function searchBugs(q) {
  const list = [];

  try {
    const url = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(q)}`;
    const html = await getText(url, 'https://music.bugs.co.kr/');
    const $ = cheerio.load(html);

    $('tr').each((_, tr) => {
      const rowHtml = $.html(tr);

      const id =
        $(tr).attr('data-trackid') ||
        rowHtml.match(/track\/(\d+)/)?.[1] ||
        rowHtml.match(/trackId=(\d+)/)?.[1];

      if (!id) return;

      const title = $(tr).find('.title a').first().text().trim();
      const artist = $(tr).find('.artist a').first().text().trim();

      if (!title) return;

      list.push({
        artist,
        title,
        melon: '',
        genie: '',
        bugs: id,
        vibe: '',
        score: getScore(q, artist, title)
      });
    });
  } catch {}

  return list;
}

async function searchVibe(q) {
  const list = [];

  try {
    const url =
      `https://apis.naver.com/vibeWeb/musicapiweb/v4/search/all?query=${encodeURIComponent(q)}&start=1&display=10`;

    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        'accept': 'application/json',
        'referer': 'https://vibe.naver.com/'
      }
    });

    if (!res.ok) return [];

    const data = await res.json();
    const tracks =
      data?.response?.result?.track?.tracks ||
      data?.result?.track?.tracks ||
      [];

    tracks.forEach(track => {
      const id = track.trackId || track.id;
      const title = track.trackTitle || track.title || track.name || '';
      const artist =
        track.artists?.map(a => a.artistName || a.name).join(', ') ||
        track.artistName ||
        '';

      if (!id || !title) return;

      list.push({
        artist,
        title,
        melon: '',
        genie: '',
        bugs: '',
        vibe: String(id),
        score: getScore(q, artist, title)
      });
    });
  } catch {}

  return list;
}

function mergeResults(...groups) {
  const merged = [];

  groups.flat().forEach(item => {
    if (!item.title) return;
    addResult(merged, item);
  });

  return merged
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: '검색어가 없습니다.' });
  }

  const [melon, genie, bugs, vibe] = await Promise.all([
    searchMelon(q),
    searchGenie(q),
    searchBugs(q),
    searchVibe(q)
  ]);

  const results = mergeResults(melon, genie, bugs, vibe);

  res.status(200).json({
    query: q,
    results
  });
}
