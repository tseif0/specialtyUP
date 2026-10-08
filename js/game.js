// One round: the card order, the clock and the score.

import { seenCards, setSeenCards } from './storage.js';

export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cards not seen in recent rounds come first; once the whole deck has been
// seen, the history resets.
export function dealOrder(deck) {
  let seen = new Set(seenCards(deck.id));
  let fresh = deck.cards.filter((c) => !seen.has(c));
  if (!fresh.length) {
    seen = new Set();
    fresh = deck.cards;
    setSeenCards(deck.id, []);
  }
  return [...shuffle(fresh), ...shuffle(deck.cards.filter((c) => seen.has(c)))];
}

export class Round {
  constructor(deck, seconds) {
    this.deck = deck;
    this.seconds = seconds;
    this.queue = dealOrder(deck);
    this.index = 0;
    this.results = []; // { card, result: 'correct' | 'pass' }
    this.endsAt = null;
  }

  start(now = performance.now()) {
    this.endsAt = now + this.seconds * 1000;
  }

  get card() {
    return this.queue[this.index] ?? null;
  }

  get hasNext() {
    return this.index + 1 < this.queue.length;
  }

  get score() {
    return this.results.filter((r) => r.result === 'correct').length;
  }

  timeLeft(now = performance.now()) {
    return Math.max(0, this.endsAt - now);
  }

  answer(result) {
    if (!this.card) return;
    this.results.push({ card: this.card, result });
  }

  advance() {
    this.index++;
    return this.card;
  }

  // Remember which cards came up so the next round favors new ones.
  finish() {
    const shown = this.results.map((r) => r.card);
    setSeenCards(this.deck.id, [...new Set([...seenCards(this.deck.id), ...shown])]);
  }
}
