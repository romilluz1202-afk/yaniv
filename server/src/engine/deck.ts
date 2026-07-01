// יצירת חפיסה וערבוב דטרמיניסטי (seeded) — מאפשר בדיקות צפויות
// Deck creation + deterministic (seeded) shuffle for reproducible tests
import { Card, Suit, Rank, SUITS } from '../../../shared/types';

// חפיסה סטנדרטית: 52 קלפים + 2 ג'וקרים = 54
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}${rank}`, suit, rank: rank as Rank, joker: false });
    }
  }
  deck.push({ id: 'JOKER1', suit: null, rank: 0, joker: true });
  deck.push({ id: 'JOKER2', suit: null, rank: 0, joker: true });
  return deck;
}

// מחולל מספרים פסאודו-אקראי דטרמיניסטי (mulberry32)
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ערבוב Fisher-Yates. seed אופציונלי — אם לא ניתן, אקראי אמיתי
export function shuffle<T>(arr: T[], seed?: number): T[] {
  const rng = seed === undefined ? Math.random : makeRng(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ערך קלף בודד לצורך ניקוד: אס=1, 2-10 כערכם, J/Q/K=10, ג'וקר=0
export function cardValue(card: Card): number {
  if (card.joker) return 0;
  if (card.rank >= 11) return 10; // J, Q, K
  return card.rank;
}
