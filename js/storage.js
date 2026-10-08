// Small wrappers around localStorage. Everything stays on this phone.

const KEYS = {
  settings: 'headsup.settings.v1',
  best: 'headsup.best.v1',
  seen: 'headsup.seen.v1',
};

export const DEFAULT_SETTINGS = {
  roundSeconds: 60,
  triggerDeg: 45,
  swap: false,
  sound: true,
  tapButtons: false,
};

export function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(KEYS.settings, {}) };
}

export function saveSettings(settings) {
  writeJSON(KEYS.settings, settings);
}

export function bestScore(deckId) {
  return readJSON(KEYS.best, {})[deckId] ?? null;
}

// Returns true when the score beats the previous best.
export function recordScore(deckId, score) {
  const best = readJSON(KEYS.best, {});
  if (best[deckId] != null && best[deckId] >= score) return false;
  best[deckId] = score;
  writeJSON(KEYS.best, best);
  return true;
}

export function seenCards(deckId) {
  return readJSON(KEYS.seen, {})[deckId] ?? [];
}

export function setSeenCards(deckId, cards) {
  const seen = readJSON(KEYS.seen, {});
  seen[deckId] = cards;
  writeJSON(KEYS.seen, seen);
}
