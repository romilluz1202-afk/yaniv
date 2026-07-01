// אימות מקומי של בחירת קלפים לזריקה (אופטימי — השרת הוא ה-authority)
import type { Card } from '@shared/types';

export function cardValue(c: Card): number {
  if (c.joker) return 0;
  if (c.rank >= 11) return 10;
  return c.rank;
}

export function handValue(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

function isSet(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const ranks = cards.filter((c) => !c.joker).map((c) => c.rank);
  return ranks.every((r) => r === ranks[0]);
}

function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const naturals = cards.filter((c) => !c.joker);
  const jokers = cards.length - naturals.length;
  if (naturals.length) {
    const suit = naturals[0].suit;
    if (!naturals.every((c) => c.suit === suit)) return false;
  }
  const ranks = naturals.map((c) => c.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) if (ranks[i] === ranks[i - 1]) return false;
  if (!ranks.length) return true;
  const span = cards.length;
  const minStart = Math.max(1, ranks[ranks.length - 1] - span + 1);
  for (let start = minStart; start <= ranks[0]; start++) {
    const end = start + span - 1;
    if (end > 13) continue;
    if (ranks.some((r) => r < start || r > end)) continue;
    if (span - ranks.length <= jokers) return true;
  }
  return false;
}

// האם הבחירה היא צירוף חוקי לזריקה
export function isValidSelection(cards: Card[]): boolean {
  if (cards.length === 1) return true;
  if (isSet(cards)) return true;
  if (isRun(cards)) return true;
  return false;
}
