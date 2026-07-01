// אימות צירופי זריקה (בודד/סט/רצף), ערך יד, ובדיקת קצות ניתנים למשיכה
// Discard combo validation (single/set/run), hand value, pickable ends
import { Card, ComboKind } from '../../../shared/types';
import { cardValue } from './deck';

export function handValue(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardValue(c), 0);
}

export function canCallYaniv(hand: Card[], threshold = 7): boolean {
  return handValue(hand) <= threshold;
}

export interface DiscardValidation {
  valid: boolean;
  kind?: ComboKind;
  reason?: string;
}

// סט: 2+ קלפים מאותו rank (ג'וקר משלים כל rank)
function isSet(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const ranks = cards.filter((c) => !c.joker).map((c) => c.rank);
  if (ranks.length === 0) return true; // רק ג'וקרים — נדיר, אך תקין כסט
  return ranks.every((r) => r === ranks[0]);
}

// רצף: 3+ קלפים עוקבים מאותה צורה; אס תמיד נמוך (A-2-3 תקין, Q-K-A לא);
// ג'וקר משמש כתחליף לכל קלף חסר ברצף
function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;

  const naturals = cards.filter((c) => !c.joker);
  const jokerCount = cards.length - naturals.length;

  // כל הקלפים הטבעיים חייבים להיות מאותה צורה
  if (naturals.length > 0) {
    const suit = naturals[0].suit;
    if (!naturals.every((c) => c.suit === suit)) return false;
  }

  // אין כפילויות rank בקלפים הטבעיים (רצף אמיתי)
  const ranks = naturals.map((c) => c.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] === ranks[i - 1]) return false;
  }

  // צריך למקם ג'וקרים כדי לסגור פערים לאורך window בגודל cards.length.
  // ננסה כל נקודת התחלה אפשרית לרצף עוקב שמכסה את כל הקלפים הטבעיים.
  if (ranks.length === 0) return true; // רק ג'וקרים
  const span = cards.length;
  const minStart = Math.max(1, ranks[ranks.length - 1] - span + 1);
  const maxStart = ranks[0];
  for (let start = minStart; start <= maxStart; start++) {
    const end = start + span - 1;
    if (end > 13) continue; // אס נמוך בלבד, אין גלישה מעל מלך
    // כל rank טבעי חייב ליפול בחלון [start, end]
    if (ranks.some((r) => r < start || r > end)) continue;
    // מספר החורים בחלון שלא מכוסים על ידי קלפים טבעיים = כמה ג'וקרים נדרשים
    const holes = span - ranks.length;
    if (holes <= jokerCount) return true;
  }
  return false;
}

// אימות זריקה: חייב להיות בודד, סט, או רצף
export function validateDiscard(cards: Card[]): DiscardValidation {
  if (cards.length === 0) return { valid: false, reason: 'no-cards' };
  if (cards.length === 1) return { valid: true, kind: 'single' };
  if (isSet(cards)) return { valid: true, kind: 'set' };
  if (isRun(sortForRun(cards))) return { valid: true, kind: 'run' };
  return { valid: false, reason: 'invalid-combo' };
}

// סדר הנחת הקלפים על ערימת הזריקה — רצף ממוין כדי שהקצוות יהיו נכונים
export function orderForDiscard(cards: Card[], kind: ComboKind): Card[] {
  return kind === 'run' ? sortForRun(cards) : cards.slice();
}

// מיון עזר לרצף — לפי rank (ג'וקרים בסוף), לא משנה את הקלט
function sortForRun(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    if (a.joker) return 1;
    if (b.joker) return -1;
    return a.rank - b.rank;
  });
}

// אילו קלפים מהזריקה הקודמת ניתן להרים: הקצה הראשון והאחרון בלבד.
// עבור קלף בודד — אותו קלף. עבור סט/רצף — שני הקצוות (ללא כפילות).
export function pickableCards(prevDiscard: Card[]): Card[] {
  if (prevDiscard.length === 0) return [];
  if (prevDiscard.length === 1) return [prevDiscard[0]];
  const first = prevDiscard[0];
  const last = prevDiscard[prevDiscard.length - 1];
  return first.id === last.id ? [first] : [first, last];
}
