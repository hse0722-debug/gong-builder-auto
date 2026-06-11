let gongs = JSON.parse(localStorage.getItem('gongs_auto') || '[]');
let searchResults = [];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function autoSearchSid() {
  const q = $('keyword').value.trim();

  if (!q) {
    return alert('가수명 + 곡명을 입력하세요.');
  }

  $('searchStatus').textContent = '검색 중입니다...';
  $('searchResults').innerHTML = '';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '검색 실패');
    }

    searchResults = data.results || [];

    if (!searchResults.length) {
      $('searchStatus').textContent = '검색 결과가 없습니다. SID를 직접 입력하세요.';
      return;
    }

    $('searchResults').innerHTML = searchResults.map((song, i) => `
      <button class="search-item" onclick="selectSong(${i})">
        ${escapeHtml(song.artist)} - ${escapeHtml(song.title)}
        <small>M:${song.melon || '-'}|G:${song.genie || '-'}|B:${song.bugs || '-'}|N:${song.vibe || '-'}</small>
      </button>
    `).join('');

    $('searchStatus').textContent = '곡을 선택하면 SID 4개가 한 번에 입력됩니다.';
  } catch (e) {
    $('searchStatus').textContent = '검색 실패: ' + e.message;
  }
}

function selectSong(i) {
  const song = searchResults[i];

  $('keyword').value = `${song.artist}-${song.title}`;
  $('melon').value = song.melon || '';
  $('genie').value = song.genie || '';
  $('bugs').value = song.bugs || '';
  $('vibe').value = song.vibe || '';

  $('searchStatus').textContent = `${song.artist} - ${song.title} SID 입력 완료`;
}

function checkSid(site) {
  const id = $(site).value.trim();

  if (!id) {
    return alert('SID가 비어 있습니다.');
  }

  const urls = {
    melon: `https://www.melon.com/song/detail.htm?songId=${id}`,
    genie: `https://www.genie.co.kr/detail/songInfo?xgnm=${id}`,
    bugs: `https://music.bugs.co.kr/track/${id}`,
    vibe: `https://vibe.naver.com/track/${id}`
  };

  window.open(urls[site], '_blank');
}

function dottedName(text = '') {
  return String(text)
    .replace(/\s+/g, '')
    .split('')
    .join('.');
}

function parseArtistTitle(keyword = '') {
  const text = String(keyword).trim();

  if (text.includes('-')) {
    const [artist, ...rest] = text.split('-');

    return {
      artist: artist.trim(),
      title: rest.join('-').trim()
    };
  }

  const parts = text.split(/\s+/);

  return {
    artist: parts[0] || '',
    title: parts.slice(1).join('')
  };
}

function formatGong(g) {
  const { artist, title } = parseArtistTitle(g.keyword);
  const artistDot = dottedName(artist);
  const titleClean = String(title).replace(/\s+/g, '');

  const sidParts = [];

  if (g.sid.melon) sidParts.push(`M:${g.sid.melon}`);
  if (g.sid.genie) sidParts.push(`G:${g.sid.genie}`);
  if (g.sid.bugs) sidParts.push(`B:${g.sid.bugs}`);
  if (g.sid.vibe) sidParts.push(`N:${g.sid.vibe}`);

  return [
    g.time,
    artistDot,
    g.gallery,
    `총공명 : ${g.title}`,
    `스밍 : ${artistDot}-${titleClean}`,
    `SID ${sidParts.join('|')}`
  ].filter(Boolean).join('\n');
}

function addGong() {
  const item = {
    time: $('time').value.trim(),
    keyword: $('keyword').value.trim(),
    gallery: $('gallery').value.trim(),
    title: $('title').value.trim(),
    sid: {
      melon: $('melon').value.trim(),
      genie: $('genie').value.trim(),
      bugs: $('bugs').value.trim(),
      vibe: $('vibe').value.trim()
    }
  };

  if (!item.gallery || !item.title) {
    return alert('갤주소와 총공 제목은 꼭 입력하세요.');
  }

  if (!item.sid.melon && !item.sid.genie && !item.sid.bugs && !item.sid.vibe) {
    return alert('SID가 하나 이상 필요합니다.');
  }

  gongs.push(item);
  save();
  render();
}

function makeText() {
  return gongs.map(g => formatGong(g)).join('\n\n');
}

function render() {
  $('list').innerHTML = gongs.map((g, i) => `
    <div class="item">
      <pre>${escapeHtml(formatGong(g))}</pre>
      <button onclick="removeGong(${i})">삭제</button>
    </div>
  `).join('');

  $('result').value = makeText();
}

function removeGong(i) {
  gongs.splice(i, 1);
  save();
  render();
}

function save() {
  localStorage.setItem('gongs_auto', JSON.stringify(gongs));
}

function clearAll() {
  if (confirm('전부 삭제할까요?')) {
    gongs = [];
    save();
    render();
  }
}

async function copyResult() {
  $('result').value = makeText();
  await navigator.clipboard.writeText($('result').value);
  alert('복사했습니다.');
}

function makeImage() {
  const text = makeText() || '내용이 없습니다.';
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 28;
  const padding = 40;
  const lines = text.split('\n');

  canvas.width = 1000;
  canvas.height = Math.max(400, padding * 2 + lines.length * 42);

  ctx.fillStyle = '#fff8ed';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#222';
  ctx.font = `${fontSize}px Arial`;

  lines.forEach((line, i) => {
    ctx.fillText(line, padding, padding + i * 42);
  });

  const link = $('download');
  link.href = canvas.toDataURL('image/png');
  link.download = 'gong-builder.png';
  link.style.display = 'inline-block';
  link.textContent = '이미지 다운로드';
}

render();
