import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36';

const SONG_DB = [
  {
    artist: '포레스텔라',
    title: 'Armageddon',
    melon: '601812679',
    genie: '114676440',
    bugs: '131827359',
    vibe: '102962533'
  }
];

function clean(text = '') {
  return String(text).toLowerCase().replace(/\s+/g, '').replace(/[^\w가-힣]/g, '');
}

function score(q, artist, title) {
  const query = clean(q);
  const target = clean(`${artist}${title}`);
  let s = 0;

  if (target.includes(query)) s += 100;

  q.split(/\s+/).forEach(word => {
    if (word && target.includes(clean(word))) s += 20;
  });

  return s;
}

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

function dbSearch(q) {
  return SONG_DB
    .map(song => ({
      ...song,
      source: 'DB',
      score: score(q, song.artist, song.title)
    }))
    .filter(song => song.score > 0);
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

      const title =
        $(tr).find('.ellipsis.rank01 a').first().text().trim() ||
        $(tr).find('.fc_gray').first().text().trim();

      const artist =
        $(tr).find('.ellipsis.rank02 a').first().text().trim() ||
        $(tr).find('.checkEllipsis').first().text().trim();

      if (!title && !artist) return;

      list.push({
        artist,
        title,
        melon: id,
        genie: '',
        bugs: '',
        vibe: '',
        source: 'melon',
        score: score(q, artist, title)
      });
    });

    return list;
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

      const title = $(tr).find('.title').first().text().replace('TITLE', '').trim();
      const artist = $(tr).find('.artist').first().text().trim();

      if (!title && !artist) return;

      list.push({
        artist,
        title,
        melon: '',
        genie: id,
        bugs: '',
        vibe: '',
        source: 'genie',
        score: score(q, artist, title)
      });
    });

    return list;
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
        rowHtml.match(/track\/(\d+)/)?.[1];

      if (!id) return;

      const title = $(tr).find('.title a').first().text().trim();
      const artist = $(tr).find('.artist a').first().text().trim();

      if (!title && !artist) return;

      list.push({
        artist,
        title,
        melon: '',
        genie: '',
        bugs: id,
        vibe: '',
        source: 'bugs',
        score: score(q, artist, title)
      });
    });

    return list;
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
        artist: '',
        title: 'VIBE 검색결과',
        melon: '',
        genie: '',
        bugs: '',
        vibe: m[1],
        source: 'vibe',
        score: 1
      });
    });

    return list;
  } catch {
    return [];
  }
}

function mergeSongs(list) {
  const map = new Map();

  list.forEach(song => {
    const key = clean(`${song.artist}${song.title}`) || `${song.source}-${song.melon || song.genie || song.bugs || song.vibe}`;

    if (!map.has(key)) {
      map.set(key, {
        artist: song.artist,
        title: song.title,
        melon: '',
        genie: '',
        bugs: '',
        vibe: '',
        score: 0
      });
    }

    const item = map.get(key);

    if (song.artist && !item.artist) item.artist = song.artist;
    if (song.title && !item.title) item.title = song.title;

    if (song.melon) item.melon = song.melon;
    if (song.genie) item.genie = song.genie;
    if (song.bugs) item.bugs = song.bugs;
    if (song.vibe) item.vibe = song.vibe;

    item.score += song.score || 0;
  });

  return [...map.values()]
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

  const results = mergeSongs([
    ...dbSearch(q),
    ...melon,
    ...genie,
    ...bugs,
    ...vibe
  ]);

  res.status(200).json({
    query: q,
    results
  });
}
