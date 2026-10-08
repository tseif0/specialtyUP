import { requestMotionPermission, TiltDetector } from './motion.js';
import { listDecks, getDeck, saveDeck, deleteDeck, parseImport, exportFile, shareUrl, deckFromHash } from './decks.js';
import { loadSettings, saveSettings, bestScore, recordScore } from './storage.js';
import { Round } from './game.js';
import { sounds, unlockAudio, setSoundEnabled, buzz } from './sound.js';

const $ = (id) => document.getElementById(id);

const settings = loadSettings();
setSoundEnabled(settings.sound);
const detector = new TiltDetector({ triggerDeg: settings.triggerDeg, swap: settings.swap });

let currentDeckId = null;
let editingId = null;

// ---------- Helpers ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

function show(name) {
  $('toast').hidden = true;
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.dataset.screen !== name;
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function roundLabel(seconds) {
  return seconds >= 120 ? `${seconds / 60} minute round` : `${seconds} second round`;
}

// ---------- Home ----------

function renderHome() {
  const list = $('deck-list');
  list.replaceChildren();
  for (const deck of listDecks()) {
    const best = bestScore(deck.id);
    const details = [plural(deck.cards.length, 'card'), best != null ? `best ${best}` : null, deck.builtin ? 'built in' : null]
      .filter(Boolean).join(' · ');
    const item = el('button', { class: 'deck-item' }, el('strong', {}, deck.name), el('span', {}, details));
    item.addEventListener('click', () => openDeck(deck.id));
    list.append(item);
  }
  show('home');
}

$('new-deck').addEventListener('click', () => openEditor(null));

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const drafts = parseImport(await file.text(), file.name);
    const saved = drafts.map((d) => saveDeck(d));
    toast(`Imported ${plural(saved.length, 'deck')}`);
    if (saved.length === 1) openDeck(saved[0].id);
    else renderHome();
  } catch (err) {
    toast(err.message);
  }
});

for (const button of document.querySelectorAll('[data-go]')) {
  button.addEventListener('click', () => {
    if (button.dataset.go === 'home') renderHome();
    if (button.dataset.go === 'settings') openSettings();
  });
}

// ---------- Deck detail ----------

function openDeck(id) {
  const deck = getDeck(id);
  if (!deck) return renderHome();
  currentDeckId = id;
  $('deck-name').textContent = deck.name;
  $('deck-desc').textContent = deck.description || '';
  const best = bestScore(deck.id);
  $('deck-meta').textContent = [plural(deck.cards.length, 'card'), roundLabel(settings.roundSeconds), best != null ? `best score ${best}` : null]
    .filter(Boolean).join(' · ');
  $('edit-deck').textContent = deck.builtin ? 'Copy and edit' : 'Edit';
  $('delete-deck').hidden = !!deck.builtin;
  show('deck');
}

$('edit-deck').addEventListener('click', () => {
  const deck = getDeck(currentDeckId);
  if (deck.builtin) openEditor({ name: `${deck.name} (copy)`, description: deck.description, cards: deck.cards });
  else openEditor(deck);
});

$('share-deck').addEventListener('click', async () => {
  const deck = getDeck(currentDeckId);
  const url = shareUrl(deck);
  if (navigator.share) {
    try { await navigator.share({ title: deck.name, url }); } catch { /* closed the share sheet */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    prompt('Copy this link:', url);
  }
});

$('export-deck').addEventListener('click', () => {
  const { filename, blob } = exportFile(getDeck(currentDeckId));
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$('delete-deck').addEventListener('click', () => {
  const deck = getDeck(currentDeckId);
  if (!confirm(`Delete "${deck.name}"? This can't be undone.`)) return;
  deleteDeck(deck.id);
  toast('Deck deleted');
  renderHome();
});

// ---------- Editor ----------

function openEditor(deck) {
  editingId = deck?.id ?? null;
  $('editor-title').textContent = editingId ? 'Edit deck' : 'New deck';
  $('editor-name').value = deck?.name ?? '';
  $('editor-desc').value = deck?.description ?? '';
  $('editor-cards').value = (deck?.cards ?? []).join('\n');
  $('editor-error').textContent = '';
  updateCardCount();
  show('editor');
}

function editorLines() {
  return $('editor-cards').value.split('\n').map((s) => s.trim()).filter(Boolean);
}

function updateCardCount() {
  $('editor-count').textContent = plural(editorLines().length, 'card');
}

$('editor-cards').addEventListener('input', updateCardCount);
$('editor-cancel').addEventListener('click', () => (editingId ? openDeck(editingId) : renderHome()));
$('editor-save').addEventListener('click', () => {
  try {
    const deck = saveDeck({ id: editingId, name: $('editor-name').value, description: $('editor-desc').value, cards: editorLines() });
    toast('Saved');
    openDeck(deck.id);
  } catch (err) {
    $('editor-error').textContent = err.message;
  }
});

// ---------- Settings ----------

function openSettings() {
  $('set-seconds').value = String(settings.roundSeconds);
  $('set-trigger').value = String(settings.triggerDeg);
  $('set-trigger-val').textContent = `${settings.triggerDeg}°`;
  $('set-swap').checked = settings.swap;
  $('set-sound').checked = settings.sound;
  $('set-tap').checked = settings.tapButtons;
  show('settings');
}

function applySettings() {
  settings.roundSeconds = Number($('set-seconds').value);
  settings.triggerDeg = Number($('set-trigger').value);
  settings.swap = $('set-swap').checked;
  settings.sound = $('set-sound').checked;
  settings.tapButtons = $('set-tap').checked;
  $('set-trigger-val').textContent = `${settings.triggerDeg}°`;
  detector.triggerDeg = settings.triggerDeg;
  detector.swap = settings.swap;
  setSoundEnabled(settings.sound);
  saveSettings(settings);
}

for (const id of ['set-seconds', 'set-trigger', 'set-swap', 'set-sound', 'set-tap']) {
  $(id).addEventListener('input', applySettings);
  $(id).addEventListener('change', applySettings);
}

// ---------- Game ----------
// Phases: ready -> countdown -> card <-> feedback -> over

const stage = $('stage');
let round = null;
let mode = 'sensor'; // or 'tap' when there is no motion data
let phase = 'idle';
let readySince = null;
let feedbackAt = 0;
let rearmed = false;
let clock = null;
let lastSecond = null;
let pending = [];
let wakeLock = null;

function later(fn, ms) {
  pending.push(setTimeout(fn, ms));
}

function clearPending() {
  pending.forEach(clearTimeout);
  pending = [];
  clearInterval(clock);
  clock = null;
}

function setView(view) {
  stage.dataset.view = view;
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch { /* not supported or not allowed */ }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function enterFullscreen() {
  const root = document.documentElement;
  if (!root.requestFullscreen || document.fullscreenElement) return;
  root.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function pageIsPortrait() {
  return window.matchMedia('(orientation: portrait)').matches;
}

// When the page is stuck in portrait but the phone is held sideways,
// rotate the stage to match the phone.
function updateRotation(up, raw) {
  let rotation = stage.classList.contains('rot-cw') ? 'cw' : stage.classList.contains('rot-ccw') ? 'ccw' : null;
  if (!pageIsPortrait()) rotation = null;
  else if (Math.abs(raw) < 50) {
    if (Math.abs(up.x) > Math.abs(up.y) * 1.2) rotation = up.x > 0 ? 'cw' : 'ccw';
    else if (Math.abs(up.y) > Math.abs(up.x) * 1.2) rotation = null;
  }
  stage.classList.toggle('rot-cw', rotation === 'cw');
  stage.classList.toggle('rot-ccw', rotation === 'ccw');
}

function heldSideways() {
  return !pageIsPortrait() || stage.classList.contains('rot-cw') || stage.classList.contains('rot-ccw');
}

function startGame() {
  // Ask for motion access first, while still inside the tap (iPhone needs this).
  const permission = requestMotionPermission();
  unlockAudio();
  enterFullscreen();
  requestWakeLock();

  const deck = getDeck(currentDeckId);
  round = new Round(deck, settings.roundSeconds);
  clearPending();
  phase = 'ready';
  readySince = null;
  mode = 'sensor';
  stage.classList.remove('rot-cw', 'rot-ccw');
  stage.classList.toggle('show-taps', settings.tapButtons);
  $('stage-deck').textContent = deck.name;
  $('ready-title').textContent = 'Place on forehead';
  $('ready-sub').textContent = 'Screen facing out. Nod down for correct, tilt back to pass.';
  $('tap-start').hidden = true;
  setView('ready');
  show('stage');

  permission.then((result) => {
    if (phase !== 'ready') return;
    if (result !== 'granted') return useTapMode(result === 'denied'
      ? 'Motion access was denied. Reload the page to be asked again.'
      : 'This browser has no motion sensor.');
    detector.start();
    later(() => {
      if (phase === 'ready' && !detector.hasData) useTapMode('No motion data. The page must be opened over https.');
    }, 1500);
  });
}

function useTapMode(reason) {
  mode = 'tap';
  detector.stop();
  stage.classList.add('show-taps');
  $('ready-title').textContent = 'Tap to play';
  $('ready-sub').textContent = reason;
  $('tap-start').hidden = false;
}

$('tap-start').addEventListener('click', beginCountdown);

function beginCountdown() {
  if (phase !== 'ready') return;
  phase = 'countdown';
  setView('countdown');
  [3, 2, 1].forEach((n, i) => later(() => { $('count').textContent = n; sounds.count(); }, i * 1000));
  later(startPlay, 3000);
}

function startPlay() {
  if (mode === 'sensor') detector.calibrate();
  sounds.go();
  phase = 'card';
  round.start();
  lastSecond = null;
  setView('play'); // before showCard, so the card has a size to fit the text into
  showCard();
  updateClock();
  clock = setInterval(updateClock, 100);
}

function fitText(node) {
  let size = Math.min(node.clientHeight * 0.6, node.clientWidth * 0.22);
  node.style.fontSize = size + 'px';
  while (size > 14 && (node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight)) {
    size *= 0.92;
    node.style.fontSize = size + 'px';
  }
}

function showCard() {
  $('feedback').className = 'feedback';
  $('card').textContent = round.card;
  fitText($('card'));
}

function updateClock() {
  const left = round.timeLeft();
  const seconds = Math.ceil(left / 1000);
  $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('low', seconds <= 5);
  if (seconds !== lastSecond && seconds <= 5 && seconds > 0) sounds.tick();
  lastSecond = seconds;
  if (left <= 0) endRound('Time!');
}

function onGesture(result) {
  if (phase !== 'card') return;
  round.answer(result);
  sounds[result]();
  buzz(result === 'correct' ? 60 : [30, 40, 30]);
  $('feedback').className = 'feedback ' + result;
  $('feedback').textContent = result === 'correct' ? 'CORRECT' : 'PASS';
  phase = 'feedback';
  feedbackAt = performance.now();
  // Taps don't move the phone, so there is nothing to wait for.
  rearmed = mode === 'tap' || detector.armed;
  later(nextCard, 450);
}

function nextCard() {
  if (phase !== 'feedback' || !rearmed || performance.now() - feedbackAt < 440) return;
  if (!round.hasNext) return endRound('Deck done!');
  round.advance();
  phase = 'card';
  showCard();
}

function endRound(message) {
  if (phase === 'over' || phase === 'idle') return;
  phase = 'over';
  clearPending();
  detector.stop();
  sounds.buzzer();
  buzz(400);
  $('timeup-text').textContent = message;
  setView('timeup');
  later(showResults, 1600);
}

function showResults() {
  round.finish();
  const isBest = round.results.length > 0 && recordScore(round.deck.id, round.score);
  exitFullscreen();
  releaseWakeLock();
  stage.classList.remove('rot-cw', 'rot-ccw');
  phase = 'idle';

  $('result-score').textContent = round.score;
  const best = bestScore(round.deck.id);
  $('result-best').textContent = isBest ? 'New best score!' : best != null ? `${round.deck.name} · best ${best}` : round.deck.name;
  const list = $('result-list');
  list.replaceChildren();
  for (const { card, result } of round.results) {
    list.append(el('li', { class: result }, card, el('span', {}, result === 'correct' ? 'Correct' : 'Pass')));
  }
  if (!round.results.length) list.append(el('li', {}, 'No cards answered this round.'));
  show('results');
}

function quitRound() {
  clearPending();
  detector.stop();
  phase = 'idle';
  exitFullscreen();
  releaseWakeLock();
  stage.classList.remove('rot-cw', 'rot-ccw');
  openDeck(currentDeckId);
}

detector.addEventListener('tilt', (e) => {
  const { raw, up } = e.detail;
  updateRotation(up, raw);
  if (phase !== 'ready') return;
  const upright = Math.abs(raw) < 25 && heldSideways();
  $('ready-title').textContent = heldSideways() ? 'Place on forehead' : 'Turn your phone sideways';
  if (!upright) {
    readySince = null;
    return;
  }
  const now = performance.now();
  readySince ??= now;
  if (now - readySince > 600) beginCountdown();
});
detector.addEventListener('correct', () => onGesture('correct'));
detector.addEventListener('pass', () => onGesture('pass'));
detector.addEventListener('rearm', () => {
  rearmed = true;
  nextCard();
  later(nextCard, 450); // in case the phone came back before the minimum flash time
});

$('tap-correct').addEventListener('click', () => onGesture('correct'));
$('tap-pass').addEventListener('click', () => onGesture('pass'));
$('quit').addEventListener('click', quitRound);
$('play').addEventListener('click', startGame);
$('play-again').addEventListener('click', startGame);

window.addEventListener('resize', () => {
  if (phase === 'card' || phase === 'feedback') fitText($('card'));
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && phase !== 'idle') requestWakeLock();
});

// ---------- Start up ----------

function importFromLink() {
  const draft = deckFromHash(location.hash);
  if (!draft) return false;
  history.replaceState(null, '', location.pathname + location.search);
  if (!confirm(`Add the deck "${draft.name}" (${plural(draft.cards.length, 'card')})?`)) return false;
  openDeck(saveDeck(draft).id);
  return true;
}

if (!importFromLink()) renderHome();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
