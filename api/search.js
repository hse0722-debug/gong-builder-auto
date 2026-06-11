import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36';

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

function pickFirst(regex, text) {
  const m = text.match(regex);
  return m ? m[1] : '';
}

async function searchMelon(q) {
  // 멜론 통합검색 페이지에서 songId를 찾습니다. 사이트 변경/차단 시 실패할 수 있습니다.
  try {
    const url = `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const songId = pickFirst(/playSong\(['"]?\d+['"]?,\s*['"]?(\d+)['"]?\)/, html)
      || pickFirst(/songId=(\d+)/, html)
      || pickFirst(/'SONGID'\s*:\s*'?(\d+)'?/, html);
    return songId ? { id: songId, url: `https://www.melon.com/song/detail.htm?songId=${songId}` } : null;
  } catch (e) { return { error: e.message }; }
}

async function searchGenie(q) {
  try {
    const url = `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const $ = cheerio.load(html);
    let id = $('[songid]').first().attr('songid') || $('[data-song-no]').first().attr('data-song-no');
    if (!id) id = pickFirst(/songInfo\(['"]?(\d+)['"]?\)/, html) || pickFirst(/songId=(\d+)/, html) || pickFirst(/fnPlaySong\(['"]?(\d+)['"]?/, html);
    return id ? { id, url: `https://www.genie.co.kr/detail/songInfo?xgnm=${id}` } : null;
  } catch (e) { return { error: e.message }; }
}

async function searchBugs(q) {
  try {
    const url = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const $ = cheerio.load(html);
    let id = $('tr[data-trackid]').first().attr('data-trackid') || $('[trackid]').first().attr('trackid');
    if (!id) id = pickFirst(/trackId=(\d+)/, html) || pickFirst(/musicpdTrack\/(\d+)/, html) || pickFirst(/track\/(\d+)/, html);
    return id ? { id, url: `https://music.bugs.co.kr/track/${id}` } : null;
  } catch (e) { return { error: e.message }; }
}

async function searchVibe(q) {
  try {
    // VIBE는 동적 렌더링/차단이 잦아서 HTML 검색으로는 실패할 수 있습니다.
    const url = `https://vibe.naver.com/search?query=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const id = pickFirst(/track\/(\d+)/, html) || pickFirst(/"trackId"\s*:\s*"?(\d+)"?/, html) || pickFirst(/"songId"\s*:\s*"?(\d+)"?/, html);
    return id ? { id, url: `https://vibe.naver.com/track/${id}` } : null;
  } catch (e) { return { error: e.message }; }
}

async function searchYoutube(q) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const html = await getText(url);
    const id = pickFirst(/"videoId":"([a-zA-Z0-9_-]{11})"/, html);
    return id ? { id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  } catch (e) { return { error: e.message }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: '검색어가 없습니다.' });

  const [melon, genie, bugs, vibe, youtube] = await Promise.all([
    searchMelon(q), searchGenie(q), searchBugs(q), searchVibe(q), searchYoutube(q)
  ]);

  res.status(200).json({ query: q, melon, genie, bugs, vibe, youtube });
}
