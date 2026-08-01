const OWNER = 'franzschurmann';
const REPO = 'sadia-soundboard';
const BRANCH = 'main';
const SITE_PASSWORD = 'sadia';
const TOKEN_KEY = 'sb_gh_token';
const UNLOCK_KEY = 'sb_unlocked';

const gate = document.getElementById('gate');
const app = document.getElementById('app');
const gateForm = document.getElementById('gateForm');
const gateInput = document.getElementById('gateInput');
const gateError = document.getElementById('gateError');
const board = document.getElementById('board');
const emptyState = document.getElementById('emptyState');

const adminBtn = document.getElementById('adminBtn');
const adminModal = document.getElementById('adminModal');
const adminClose = document.getElementById('adminClose');
const tokenStep = document.getElementById('tokenStep');
const tokenInput = document.getElementById('tokenInput');
const tokenSave = document.getElementById('tokenSave');
const tokenError = document.getElementById('tokenError');
const adminPanel = document.getElementById('adminPanel');
const adminStatus = document.getElementById('adminStatus');
const tileList = document.getElementById('tileList');
const resetTokenBtn = document.getElementById('resetToken');

const addForm = document.getElementById('addForm');
const nameInput = document.getElementById('nameInput');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const audioInput = document.getElementById('audioInput');
const audioPreview = document.getElementById('audioPreview');
const recordBtn = document.getElementById('recordBtn');
const recordTimer = document.getElementById('recordTimer');
const saveTileBtn = document.getElementById('saveTileBtn');
const saveStatus = document.getElementById('saveStatus');

let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordingInterval = null;
let recordSeconds = 0;

// ---------- Gate ----------

if (localStorage.getItem(UNLOCK_KEY) === '1') {
  unlockApp();
}

gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = gateInput.value.trim().toLowerCase();
  if (val === SITE_PASSWORD) {
    localStorage.setItem(UNLOCK_KEY, '1');
    gateError.hidden = true;
    unlockApp();
  } else {
    gateError.hidden = false;
  }
});

function unlockApp() {
  gate.hidden = true;
  app.hidden = false;
  loadTiles();
}

// ---------- Board ----------

async function loadTiles() {
  try {
    const res = await fetch('data/tiles.json?cb=' + Date.now());
    const tiles = res.ok ? await res.json() : [];
    renderBoard(tiles);
  } catch (e) {
    renderBoard([]);
  }
}

function renderBoard(tiles) {
  board.innerHTML = '';
  emptyState.hidden = tiles.length !== 0;
  tiles.forEach((tile) => {
    const btn = document.createElement('button');
    btn.className = 'tile';

    const img = document.createElement('img');
    img.src = tile.image;
    img.alt = tile.name;

    const label = document.createElement('span');
    label.textContent = tile.name;

    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener('click', () => playTile(tile, btn));
    board.appendChild(btn);
  });
}

function playTile(tile, btn) {
  btn.classList.add('playing');
  const audio = new Audio(tile.audio);
  audio.play().catch(() => {});
  const clear = () => btn.classList.remove('playing');
  audio.addEventListener('ended', clear);
  setTimeout(clear, 6000);
}

// ---------- Admin: open/close ----------

adminBtn.addEventListener('click', () => {
  adminModal.hidden = false;
  if (localStorage.getItem(TOKEN_KEY)) {
    showAdminPanel();
  } else {
    showTokenStep();
  }
});

adminClose.addEventListener('click', () => {
  adminModal.hidden = true;
});

function showTokenStep() {
  adminPanel.hidden = true;
  tokenStep.hidden = false;
}

function showAdminPanel() {
  tokenStep.hidden = true;
  adminPanel.hidden = false;
  refreshTileList();
}

resetTokenBtn.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  showTokenStep();
});

tokenSave.addEventListener('click', async () => {
  const val = tokenInput.value.trim();
  if (!val) return;
  tokenError.hidden = true;
  tokenSave.disabled = true;
  tokenSave.textContent = 'Prüfe…';
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers: authHeaders(val) });
    if (!res.ok) throw new Error('bad token');
    localStorage.setItem(TOKEN_KEY, val);
    tokenInput.value = '';
    showAdminPanel();
  } catch (e) {
    tokenError.textContent = 'Token ungültig oder kein Zugriff auf das Repo.';
    tokenError.hidden = false;
  } finally {
    tokenSave.disabled = false;
    tokenSave.textContent = 'Speichern & weiter';
  }
});

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
}

// ---------- GitHub content helpers ----------

async function ghGetJson(path, token) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: authHeaders(token) });
  if (res.status === 404) return { sha: null, data: [] };
  if (!res.ok) throw new Error('Laden fehlgeschlagen (' + res.status + ')');
  const json = await res.json();
  const decoded = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
  return { sha: json.sha, data: JSON.parse(decoded) };
}

async function ghPutJson(path, dataObj, sha, token, message) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(dataObj, null, 2))));
  const body = { message, content, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Speichern fehlgeschlagen (' + res.status + ')');
  return res.json();
}

async function ghPutBinary(path, base64Content, token, message) {
  const body = { message, content: base64Content, branch: BRANCH };
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Datei-Upload fehlgeschlagen (' + res.status + ')');
  return res.json();
}

async function ghGetFileSha(path, token) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Fehler beim Suchen der Datei (' + res.status + ')');
  const json = await res.json();
  return json.sha;
}

async function ghDeletePath(path, sha, token, message) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
  if (!res.ok) throw new Error('Löschen fehlgeschlagen (' + res.status + ')');
}

// ---------- Admin: tile list ----------

async function refreshTileList() {
  tileList.innerHTML = '<p>Lade…</p>';
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const { data } = await ghGetJson('data/tiles.json', token);
    renderTileList(data);
  } catch (e) {
    tileList.innerHTML = '';
    adminStatus.textContent = 'Fehler: ' + e.message;
  }
}

function renderTileList(tiles) {
  tileList.innerHTML = '';
  if (!tiles.length) {
    tileList.innerHTML = '<p>Noch keine Kacheln.</p>';
    return;
  }
  tiles.forEach((tile) => {
    const row = document.createElement('div');
    row.className = 'tile-row';

    const img = document.createElement('img');
    img.src = tile.image;
    img.alt = '';

    const span = document.createElement('span');
    span.textContent = tile.name;

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => editTile(tile));

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.type = 'button';
    delBtn.addEventListener('click', () => deleteTile(tile));

    row.appendChild(img);
    row.appendChild(span);
    row.appendChild(editBtn);
    row.appendChild(delBtn);
    tileList.appendChild(row);
  });
}

async function editTile(tile) {
  const newName = prompt('Neuer Name:', tile.name);
  if (!newName || !newName.trim() || newName.trim() === tile.name) return;
  const token = localStorage.getItem(TOKEN_KEY);
  adminStatus.textContent = 'Speichere…';
  try {
    const { data, sha } = await ghGetJson('data/tiles.json', token);
    const idx = data.findIndex((x) => x.id === tile.id);
    if (idx > -1) data[idx].name = newName.trim();
    await ghPutJson('data/tiles.json', data, sha, token, `Kachel umbenennen: ${tile.name} -> ${newName.trim()}`);
    adminStatus.textContent = 'Gespeichert.';
    refreshTileList();
  } catch (e) {
    adminStatus.textContent = 'Fehler: ' + e.message;
  }
}

async function deleteTile(tile) {
  if (!confirm(`"${tile.name}" wirklich löschen?`)) return;
  const token = localStorage.getItem(TOKEN_KEY);
  adminStatus.textContent = 'Lösche…';
  try {
    const { data, sha } = await ghGetJson('data/tiles.json', token);
    const updated = data.filter((x) => x.id !== tile.id);
    await ghPutJson('data/tiles.json', updated, sha, token, `Kachel entfernen: ${tile.name}`);

    const imgSha = await ghGetFileSha(tile.image, token);
    if (imgSha) await ghDeletePath(tile.image, imgSha, token, `Foto entfernen: ${tile.name}`);
    const audSha = await ghGetFileSha(tile.audio, token);
    if (audSha) await ghDeletePath(tile.audio, audSha, token, `Audio entfernen: ${tile.name}`);

    adminStatus.textContent = 'Gelöscht. Kann bis zu einer Minute dauern, bis es auf der Seite verschwindet.';
    refreshTileList();
  } catch (e) {
    adminStatus.textContent = 'Fehler: ' + e.message;
  }
}

// ---------- Admin: add tile form ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('audioUploadTab').hidden = tab !== 'upload';
    document.getElementById('audioRecordTab').hidden = tab !== 'record';
  });
});

photoInput.addEventListener('change', () => {
  const f = photoInput.files[0];
  if (f) {
    photoPreview.src = URL.createObjectURL(f);
    photoPreview.hidden = false;
  }
});

audioInput.addEventListener('change', () => {
  const f = audioInput.files[0];
  if (f) {
    audioPreview.src = URL.createObjectURL(f);
    audioPreview.hidden = false;
  }
});

recordBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        audioPreview.src = URL.createObjectURL(recordedBlob);
        audioPreview.hidden = false;
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      recordBtn.textContent = '⏹️ Aufnahme stoppen';
      recordSeconds = 0;
      recordTimer.textContent = '0:00';
      recordingInterval = setInterval(() => {
        recordSeconds++;
        const m = Math.floor(recordSeconds / 60);
        const s = String(recordSeconds % 60).padStart(2, '0');
        recordTimer.textContent = `${m}:${s}`;
      }, 1000);
    } catch (e) {
      alert('Mikrofon-Zugriff nicht möglich: ' + e.message);
    }
  } else {
    mediaRecorder.stop();
    clearInterval(recordingInterval);
    recordBtn.textContent = '🎙️ Aufnahme starten';
  }
});

function fileToBase64(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

function extFromFile(file, fallback) {
  if (file.name) {
    const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
    if (m) return m[1].toLowerCase();
  }
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
  };
  return map[file.type] || fallback;
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'kachel'
  );
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem(TOKEN_KEY);
  const name = nameInput.value.trim();
  const photoFile = photoInput.files[0];
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;

  if (activeTab === 'record' && mediaRecorder && mediaRecorder.state === 'recording') {
    saveStatus.textContent = 'Bitte zuerst die Aufnahme stoppen.';
    return;
  }

  const audioSource = activeTab === 'upload' ? audioInput.files[0] : recordedBlob;

  if (!name || !photoFile || !audioSource) {
    saveStatus.textContent = 'Bitte Name, Foto und Ton angeben.';
    return;
  }

  saveTileBtn.disabled = true;
  saveStatus.textContent = 'Speichere…';

  try {
    const id = slugify(name) + '-' + Date.now();
    const photoExt = extFromFile(photoFile, 'jpg');
    const audioExt = activeTab === 'record' ? 'webm' : extFromFile(audioSource, 'mp3');

    const photoBase64 = await fileToBase64(photoFile);
    const audioBase64 = await fileToBase64(audioSource);

    await ghPutBinary(`media/${id}.${photoExt}`, photoBase64, token, `Foto hinzufügen: ${name}`);
    await ghPutBinary(`media/${id}.${audioExt}`, audioBase64, token, `Audio hinzufügen: ${name}`);

    const { data, sha } = await ghGetJson('data/tiles.json', token);
    data.push({ id, name, image: `media/${id}.${photoExt}`, audio: `media/${id}.${audioExt}` });
    await ghPutJson('data/tiles.json', data, sha, token, `Kachel hinzufügen: ${name}`);

    saveStatus.textContent = 'Gespeichert! Kann bis zu einer Minute dauern, bis es auf der Seite live ist.';
    addForm.reset();
    photoPreview.hidden = true;
    audioPreview.hidden = true;
    recordedBlob = null;
    recordTimer.textContent = '';
    refreshTileList();
  } catch (err) {
    saveStatus.textContent = 'Fehler: ' + err.message;
  } finally {
    saveTileBtn.disabled = false;
  }
});
