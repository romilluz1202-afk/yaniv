// מצב משחק טהור ומעברי מצב — מנותק מ-Colyseus לצורך בדיקות
// Pure game state + transitions — decoupled from Colyseus for testability
import { Card, DrawSource, GameConfig, DEFAULT_CONFIG } from '../../../shared/types';
import { createDeck, shuffle } from './deck';
import { validateDiscard, pickableCards, orderForDiscard, canCallYaniv } from './combos';

export interface EnginePlayer {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  out: boolean; // הודח מהמשחק
}

export interface EngineState {
  players: EnginePlayer[];
  deck: Card[];
  discard: Card[]; // הצירוף האחרון שנזרק (הקלף העליון), בסדר הנחה — קצוותיו ניתנים למשיכה
  pile: Card[]; // קלפים קבורים מזריקות קודמות — מקור לערבוב מחדש כשהקופה נגמרת
  turnIndex: number; // אינדקס בתוך רשימת השחקנים הפעילים
  config: GameConfig;
  seed?: number;
}

export function createGame(
  players: { id: string; name: string }[],
  config: GameConfig = DEFAULT_CONFIG,
  seed?: number
): EngineState {
  return {
    players: players.map((p) => ({ ...p, hand: [], score: 0, out: false })),
    deck: [],
    discard: [],
    pile: [],
    turnIndex: 0,
    config,
    seed,
  };
}

// שחקנים פעילים (לא הודחו)
export function activePlayers(state: EngineState): EnginePlayer[] {
  return state.players.filter((p) => !p.out);
}

export function currentPlayer(state: EngineState): EnginePlayer {
  const active = activePlayers(state);
  return active[state.turnIndex % active.length];
}

// התחלת סיבוב: ערבוב, חלוקת 5 לכל שחקן פעיל, והפיכת קלף פתיחה לערימת הזריקה
export function startRound(state: EngineState, startPlayerId?: string): void {
  const deck = shuffle(createDeck(), state.seed);
  const active = activePlayers(state);
  for (const p of active) p.hand = [];
  for (let i = 0; i < 5; i++) {
    for (const p of active) p.hand.push(deck.pop()!);
  }
  state.discard = [deck.pop()!]; // קלף פתיחה
  state.pile = [];
  state.deck = deck;
  // מי מתחיל: אם צוין, ממקמים אותו; אחרת הראשון
  if (startPlayerId) {
    const idx = active.findIndex((p) => p.id === startPlayerId);
    state.turnIndex = idx >= 0 ? idx : 0;
  } else {
    state.turnIndex = 0;
  }
}

// ערבוב מחדש כשהקופה מתרוקנת — מערבבים את הקלפים הקבורים (pile);
// הקלף העליון הנוכחי (discard) נשאר גלוי ואינו נכנס לערבוב
function ensureDeck(state: EngineState): void {
  if (state.deck.length > 0) return;
  if (state.pile.length === 0) return; // אין מה לערבב
  state.deck = shuffle(state.pile, state.seed);
  state.pile = [];
}

export interface DiscardResult {
  discarded: Card[];
  drawn: Card;
}

// זריקה + משיכה בתור אחד. זורק exception על פעולה לא חוקית.
export function discardAndDraw(
  state: EngineState,
  playerId: string,
  cardIds: string[],
  drawSource: DrawSource
): DiscardResult {
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new Error('not-your-turn');

  // איתור הקלפים ביד השחקן
  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = player.hand.find((h) => h.id === id);
    if (!c) throw new Error('card-not-in-hand');
    cards.push(c);
  }
  const validation = validateDiscard(cards);
  if (!validation.valid) throw new Error(validation.reason || 'invalid-combo');

  const prevTop = state.discard;

  // קביעת הקלף הנמשך לפני שינוי הערימה
  let drawn: Card;
  let buried: Card[]; // מה מהעליון הקודם נקבר לערימת ה-pile
  if (drawSource === 'deck') {
    ensureDeck(state);
    if (state.deck.length === 0) throw new Error('deck-empty');
    drawn = state.deck.pop()!;
    buried = prevTop; // כל העליון הקודם נקבר
  } else {
    const ends = pickableCards(prevTop);
    if (ends.length === 0) throw new Error('nothing-to-pick');
    drawn = drawSource === 'discard-first' ? ends[0] : ends[ends.length - 1];
    buried = prevTop.filter((c) => c.id !== drawn.id); // השאר נקבר
  }

  // קבירת העליון הקודם, הסרת הצירוף מהיד, והנחת הצירוף החדש כעליון
  state.pile.push(...buried);
  player.hand = player.hand.filter((h) => !cardIds.includes(h.id));
  state.discard = orderForDiscard(cards, validation.kind!);

  // הוספת הקלף הנמשך ליד
  player.hand.push(drawn);

  advanceTurn(state);
  return { discarded: cards, drawn };
}

export function advanceTurn(state: EngineState): void {
  const active = activePlayers(state);
  state.turnIndex = (state.turnIndex + 1) % active.length;
}

export function canYaniv(state: EngineState, playerId: string): boolean {
  const player = currentPlayer(state);
  if (player.id !== playerId) return false;
  return canCallYaniv(player.hand, state.config.yanivThreshold);
}
