let gongs = JSON.parse(localStorage.getItem('gongs_auto') || '[]');

function $(id) { return document.getElementById(id); }

function youtubeId(value) {
  const v = (value || '').trim();
  const m = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : v;
}

async function autoSearchSid() {
  const q = $('keyword').value.trim();
  if (!q) return alert('곡명이나 가수명을 입력하세요.');

  $('searchStatus').textContent = '검색 중입니다...';
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '검색 실패');

    $('melon').value = data.melon?.id || '';
    $('genie').value = data.genie?.id || '';
    $('bugs').value = data.bugs?.id || '';
    $('vibe').value = data.vibe?.id || '';
    $('youtube').value = data.youtube?.id || '';

    const found = ['melon','genie','bugs','vibe','youtube'].filter(k => data[k]?.id).length;
    $('searchStatus').textContent = `${found}/5개 SID를 찾았습니다. 빈칸은 직접 입력하세요.`;
  } catch (e) {
    $('searchStatus').textContent = '자동검색 실패: ' + e.message;
  }
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
      vibe: $('vibe').value.trim(),
      youtube: youtubeId($('youtube').value)
    }
  };

  if (!item.gallery || !item.title) return alert('갤주소와 총공 제목은 꼭 입력하세요.');
  if (!item.sid.melon && !item.sid.genie && !item.sid.bugs && !item.sid.vibe && !item.sid.youtube) {
    return alert('SID가 하나 이상 필요합니다.');
  }

  gongs.push(item);
  save();
  render();
}

function makeText() {
  return gongs.map((g, i) => {
    const lines = [];
    lines.push(`${g.time ? '[' + g.time + '] ' : ''}${g.title}`);
    lines.push(g.gallery);
    if (g.keyword) lines.push(`검색어: ${g.keyword}`);
    if (g.sid.melon) lines.push(`M ${g.sid.melon}`);
    if (g.sid.genie) lines.push(`G ${g.sid.genie}`);
    if (g.sid.bugs) lines.push(`B ${g.sid.bugs}`);
    if (g.sid.vibe) lines.push(`N ${g.sid.vibe}`);
    if (g.sid.youtube) lines.push(`Y ${g.sid.youtube}`);
    return lines.join('\n');
  }).join('\n\n');
}

function render() {
  $('list').innerHTML = gongs.map((g, i) => `
    <div class="item">
      <b>${i + 1}. ${g.time || ''} ${g.title}</b><br>
      <span>${g.gallery}</span><br>
      <small>M ${g.sid.melon || '-'} / G ${g.sid.genie || '-'} / B ${g.sid.bugs || '-'} / N ${g.sid.vibe || '-'} / Y ${g.sid.youtube || '-'}</small><br>
      <button onclick="removeGong(${i})">삭제</button>
    </div>
  `).join('');
  $('result').value = makeText();
}

function removeGong(i) { gongs.splice(i, 1); save(); render(); }
function save() { localStorage.setItem('gongs_auto', JSON.stringify(gongs)); }
function clearAll() { if (confirm('전부 삭제할까요?')) { gongs = []; save(); render(); } }

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
  lines.forEach((line, i) => ctx.fillText(line, padding, padding + i * 42));
  const link = $('download');
  link.href = canvas.toDataURL('image/png');
  link.download = 'gong-builder.png';
  link.style.display = 'inline-block';
  link.textContent = '이미지 다운로드';
}

render();
