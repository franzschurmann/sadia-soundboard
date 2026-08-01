const OWNER = 'franzschurmann';
const REPO = 'sadia-soundboard';
const BRANCH = 'main';
const SITE_PASSWORD = 'sadia';
const PW_KEY = 'sb_pw';

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
const loadingStep = document.getElementById('loadingStep');
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

let sitePassword = null;
let adminToken = null;

// ---------- Gate ----------

if (localStorage.getItem(PW_KEY) === SITE_PASSWORD) {
  sitePassword = SITE_PASSWORD;
  unlockApp();
}

gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = gateInput.value.trim().toLowerCase();
  if (val === SITE_PASSWORD) {
    sitePassword = val;
    localStorage.setItem(PW_KEY, val);
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
    const res = await fetch('data/tiles.json?cb=' + Date.now(), { cache: 'no-store' });
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
  tryAutoAdmin();
});

adminClose.addEventListener('click', () => {
  adminModal.hidden = true;
});

resetTokenBtn.addEventListener('click', () => {
  adminToken = null;
  showTokenSetupStep();
});

function showStep(which) {
  loadingStep.hidden = which !== 'loading';
  tokenStep.hidden = which !== 'token';
  adminPanel.hidden = which !== 'panel';
}

function showTokenSetupStep(errorMsg) {
  showStep('token');
  if (errorMsg) {
    tokenError.textContent = errorMsg;
    tokenError.hidden = false;
  } else {
    tokenError.hidden = true;
  }
}

function showAdminPanel() {
  showStep('panel');
  refreshTileList();
}

// Reads the password-encrypted token straight off the Pages site (no GitHub API,
// so no unauthenticated rate limit). Password alone is enough, on any device.
// Every failure path ends in a visible message - never leave the spinner up.
async function tryAutoAdmin() {
  if (adminToken) {
    showAdminPanel();
    return;
  }
  try {
    showStep('loading');

    const res = await fetch('data/admin.key?cb=' + Date.now(), { cache: 'no-store' });
    if (res.status === 404) {
      showTokenSetupStep('Noch kein Zugang hinterlegt — bitte einmalig einrichten:');
      return;
    }
    if (!res.ok) throw new Error('admin.key nicht ladbar (HTTP ' + res.status + ')');

    const raw = await res.text();
    let encrypted;
    try {
      encrypted = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error('admin.key ist kein gültiges JSON: ' + raw.slice(0, 40));
    }
    if (!encrypted || !encrypted.iv || !encrypted.ciphertext) {
      throw new Error('admin.key unvollständig');
    }
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Browser bietet keine Web-Crypto (nur über https:// erreichbar)');
    }
    if (!sitePassword) {
      throw new Error('Passwort nicht im Speicher — Seite neu laden');
    }

    adminToken = await decryptToken(encrypted, sitePassword);
    showAdminPanel();
  } catch (e) {
    showTokenSetupStep('Automatischer Zugang fehlgeschlagen: ' + (e && e.message ? e.message : e));
  }
}

tokenSave.addEventListener('click', async () => {
  const val = tokenInput.value.trim();
  if (!val) return;
  tokenError.hidden = true;
  tokenSave.disabled = true;
  tokenSave.textContent = 'Richte ein…';
  try {
    const check = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers: authHeaders(val) });
    if (!check.ok) throw new Error('Token ungültig oder kein Zugriff auf das Repo.');

    const encrypted = await encryptToken(val, sitePassword);
    const sha = await ghGetFileSha('data/admin.key', val);
    await ghPutJson('data/admin.key', encrypted, sha, val, 'Admin-Zugang einrichten');

    adminToken = val;
    tokenInput.value = '';
    showAdminPanel();
  } catch (e) {
    tokenError.textContent = 'Fehler: ' + e.message;
    tokenError.hidden = false;
  } finally {
    tokenSave.disabled = false;
    tokenSave.textContent = 'Einrichten';
  }
});

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
}

// ---------- Crypto (password -> AES key, hides the GitHub token at rest) ----------

async function deriveKey(password) {
  // Guard against a null/undefined password: TextEncoder would happily encode it
  // as the literal text "null", producing a key nobody can ever reproduce. That
  // silently locked the admin panel once already - fail loudly instead.
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Internes Problem: Passwort fehlt beim Verschlüsseln');
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('sadia-soundboard-salt-v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function encryptToken(token, password) {
  const key = await deriveKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
  return { iv: bufToBase64(iv), ciphertext: bufToBase64(ciphertext) };
}

async function decryptToken(encrypted, password) {
  const key = await deriveKey(password);
  const iv = base64ToBuf(encrypted.iv);
  const ciphertext = base64ToBuf(encrypted.ciphertext);
  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch (e) {
    throw new Error('Entschlüsselung fehlgeschlagen (Passwort passt nicht zum hinterlegten Zugang)');
  }
  return new TextDecoder().decode(plainBuf);
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
  adminStatus.textContent = '';
  try {
    const { data } = await ghGetJson('data/tiles.json', adminToken);
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
  adminStatus.textContent = 'Speichere…';
  try {
    const { data, sha } = await ghGetJson('data/tiles.json', adminToken);
    const idx = data.findIndex((x) => x.id === tile.id);
    if (idx > -1) data[idx].name = newName.trim();
    await ghPutJson('data/tiles.json', data, sha, adminToken, `Kachel umbenennen: ${tile.name} -> ${newName.trim()}`);
    adminStatus.textContent = 'Gespeichert.';
    refreshTileList();
  } catch (e) {
    adminStatus.textContent = 'Fehler: ' + e.message;
  }
}

async function deleteTile(tile) {
  if (!confirm(`"${tile.name}" wirklich löschen?`)) return;
  adminStatus.textContent = 'Lösche…';
  try {
    const { data, sha } = await ghGetJson('data/tiles.json', adminToken);
    const updated = data.filter((x) => x.id !== tile.id);
    await ghPutJson('data/tiles.json', updated, sha, adminToken, `Kachel entfernen: ${tile.name}`);

    const imgSha = await ghGetFileSha(tile.image, adminToken);
    if (imgSha) await ghDeletePath(tile.image, imgSha, adminToken, `Foto entfernen: ${tile.name}`);
    const audSha = await ghGetFileSha(tile.audio, adminToken);
    if (audSha) await ghDeletePath(tile.audio, audSha, adminToken, `Audio entfernen: ${tile.name}`);

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

    await ghPutBinary(`media/${id}.${photoExt}`, photoBase64, adminToken, `Foto hinzufügen: ${name}`);
    await ghPutBinary(`media/${id}.${audioExt}`, audioBase64, adminToken, `Audio hinzufügen: ${name}`);

    const { data, sha } = await ghGetJson('data/tiles.json', adminToken);
    data.push({ id, name, image: `media/${id}.${photoExt}`, audio: `media/${id}.${audioExt}` });
    await ghPutJson('data/tiles.json', data, sha, adminToken, `Kachel hinzufügen: ${name}`);

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
