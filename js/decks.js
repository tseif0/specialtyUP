// Deck storage, import/export and share links.
// A deck is { id, name, description, cards: [string] }.

import { BUILTIN_DECKS } from './builtin-decks.js';
import { readJSON, writeJSON } from './storage.js';

const KEY = 'headsup.decks.v1';
const MAX_CARDS = 1000;

function customDecks() {
  const decks = readJSON(KEY, []);
  return Array.isArray(decks) ? decks : [];
}

export function listDecks() {
  return [...BUILTIN_DECKS, ...customDecks()];
}

export function getDeck(id) {
  return listDecks().find((d) => d.id === id) ?? null;
}

export function cleanCards(lines) {
  const seen = new Set();
  const cards = [];
  for (const line of lines) {
    const card = String(line).trim();
    const key = card.toLowerCase();
    if (!card || seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
    if (cards.length >= MAX_CARDS) break;
  }
  return cards;
}

// Saves a new or edited custom deck and returns it. Throws a readable error.
export function saveDeck({ id, name, description = '', cards }) {
  name = String(name ?? '').trim();
  cards = cleanCards(cards ?? []);
  if (!name) throw new Error('Give the deck a name.');
  if (!cards.length) throw new Error('Add at least one card.');
  const decks = customDecks();
  const deck = { id: id || newId(), name, description: String(description).trim(), cards };
  const index = decks.findIndex((d) => d.id === deck.id);
  if (index >= 0) decks[index] = deck;
  else decks.push(deck);
  if (!writeJSON(KEY, decks)) throw new Error('Could not save. Is the phone out of storage?');
  return deck;
}

export function deleteDeck(id) {
  writeJSON(KEY, customDecks().filter((d) => d.id !== id));
}

function newId() {
  return 'deck-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- Import / export ----

function firstCsvColumn(line) {
  line = line.trim();
  if (!line.startsWith('"')) return line.split(',')[0];
  let out = '';
  for (let i = 1; i < line.length; i++) {
    if (line[i] === '"' && line[i + 1] === '"') { out += '"'; i++; }
    else if (line[i] === '"') break;
    else out += line[i];
  }
  return out;
}

// Turns an imported file into one or more deck drafts (not yet saved).
export function parseImport(text, filename = 'Imported deck') {
  const baseName = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported deck';
  if (/\.json$/i.test(filename) || /^\s*[[{]/.test(text)) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That JSON file could not be read.');
    }
    const items = Array.isArray(data) && data.every((d) => d && typeof d === 'object') ? data : [data];
    return items.map((d) => {
      if (Array.isArray(d)) return { name: baseName, description: '', cards: cleanCards(d) };
      if (!Array.isArray(d.cards)) throw new Error('That JSON file has no "cards" list.');
      return { name: d.name || baseName, description: d.description || '', cards: cleanCards(d.cards) };
    });
  }
  const lines = text.split(/\r?\n/);
  const cards = /\.csv$/i.test(filename) ? lines.map(firstCsvColumn) : lines;
  return [{ name: baseName, description: '', cards: cleanCards(cards) }];
}

export function exportFile(deck) {
  const data = { name: deck.name, description: deck.description || '', cards: deck.cards };
  const slug = deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
  return {
    filename: slug + '.json',
    blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  };
}

// ---- Share links: the deck rides in the URL after #deck= ----

function toBase64Url(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function shareUrl(deck) {
  const payload = toBase64Url(JSON.stringify({ n: deck.name, d: deck.description || '', c: deck.cards }));
  const url = new URL(location.href);
  url.search = '';
  url.hash = 'deck=' + payload;
  return url.toString();
}

// Returns a deck draft from a #deck= hash, or null.
export function deckFromHash(hash) {
  const match = /^#?deck=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match) return null;
  try {
    const data = JSON.parse(fromBase64Url(match[1]));
    const cards = cleanCards(Array.isArray(data.c) ? data.c : []);
    if (!data.n || !cards.length) return null;
    return { name: String(data.n), description: String(data.d || ''), cards };
  } catch {
    return null;
  }
}
