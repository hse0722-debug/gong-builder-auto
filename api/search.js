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
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w가-힣]/g, '');
}

function matchScore(q, song) {
  const query = clean(q);
  const target = clean(`${song.artist}${song.title}`);

  let score = 0;
  if (target.includes(query)) score += 100;

  q.split(/\s+/).forEach(word => {
    if (target.includes(clean(word))) score += 20;
  });

  return score;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: '검색어가 없습니다.' });
  }

  const results = SONG_DB
    .map(song => ({
      ...song,
      score: matchScore(q, song)
    }))
    .filter(song => song.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.status(200).json({ query: q, results });
}
