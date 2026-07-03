// מצב משחק טהור ומעברי מצב — מנותק מ-Colyseus לצורך בדיקות
// Pure game state + transitions — decoupled from Colyseus for testability
import { Card, DrawSource, ComboKind, GameConfig, DEFAULT_CONFIG } from '../../../shared/types';
import { createDeck, shuffle } from './deck';
import { validateDiscard, pickableCards, orderForDiscard, canCallYaniv } from './combos';

export interface EnginePlayer {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  out: boolean; // הודח מהמשחק
}

// חלון הדבקה: נפתח כשמושכים מהקופה קלף בעל ערך זהה למה שנזרק זה עתה,
// ונסגר ברגע שהשחקן הבא משחק (או בהכרזת יניב)
export interface SlapWindow {
  playerId: string;
  cardId: string; // רק הקלף שנמשך הרגע ניתן להדבקה
}

export interface EngineState {
  players: EnginePlayer[];
  deck: Card[];
  discard: Card[]; // הצירוף האחרון שנזרק (העליון) + קלפים שהודבקו עליו
  discardKind: ComboKind; // סוג הצירוף העליון — קובע אילו קלפים ניתנים למשיכה
  slappedIds: string[]; // מזהי קלפים שהודבקו — אינם ניתנים למשיכה
  pile: Card[]; // קלפים קבורים מזריקות קודמות — מקור לערבוב מחדש כשהקופה נגמרת
  slapWindow: SlapWindow | null;
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
    discardKind: 'single',
    slappedIds: [],
    pile: [],
    slapWindow: null,
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
  state.discardKind = 'single';
  state.slappedIds = [];
  state.slapWindow = null;
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

// הקלפים שמותר כרגע למשוך מהזריקה (לשימוש השרת/לקוח)
export function currentPickable(state: EngineState): Card[] {
  return pickableCards(state.discard, state.discardKind, state.slappedIds);
}

// ערבוב מחדש כשהקופה מתרוקנת — מערבבים את הקלפים הקבורים (pile);
// הצירוף העליון הנוכחי נשאר גלוי ואינו נכנס לערבוב
function ensureDeck(state: EngineState): void {
  if (state.deck.length > 0) return;
  if (state.pile.length === 0) return; // אין מה לערבב
  state.deck = shuffle(state.pile, state.seed);
  state.pile = [];
}

export interface DiscardResult {
  discarded: Card[];
  drawn: Card;
  slapOpened: boolean; // האם נפתח חלון הדבקה לשחקן
}

// זריקה + משיכה בתור אחד. זורק exception על פעולה לא חוקית.
// drawSource='discard' מחייב pickupId — הקלף הספציפי שנלקח מהערימה.
export function discardAndDraw(
  state: EngineState,
  playerId: string,
  cardIds: string[],
  drawSource: DrawSource,
  pickupId?: string
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

  // תור חדש התחיל — חלון ההדבקה של התור הקודם נסגר
  state.slapWindow = null;

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
    const allowed = pickableCards(prevTop, state.discardKind, state.slappedIds);
    const pick = allowed.find((c) => c.id === pickupId);
    if (!pick) throw new Error(allowed.length ? 'invalid-pickup' : 'nothing-to-pick');
    drawn = pick;
    buried = prevTop.filter((c) => c.id !== drawn.id); // השאר נקבר
  }

  // קבירת העליון הקודם, הסרת הצירוף מהיד, והנחת הצירוף החדש כעליון
  state.pile.push(...buried);
  player.hand = player.hand.filter((h) => !cardIds.includes(h.id));
  state.discard = orderForDiscard(cards, validation.kind!);
  state.discardKind = validation.kind!;
  state.slappedIds = [];

  // הוספת הקלף הנמשך ליד
  player.hand.push(drawn);

  // פתיחת חלון הדבקה: משיכה מהקופה של קלף בעל ערך זהה לזריקה (בודד/סט בלבד)
  let slapOpened = false;
  if (drawSource === 'deck' && (validation.kind === 'single' || validation.kind === 'set')) {
    const naturals = cards.filter((c) => !c.joker);
    const matchRank = naturals.length
      ? !drawn.joker && drawn.rank === naturals[0].rank
      : drawn.joker; // ג'וקר על ג'וקר
    if (matchRank) {
      state.slapWindow = { playerId, cardId: drawn.id };
      slapOpened = true;
    }
  }

  advanceTurn(state);
  return { discarded: cards, drawn, slapOpened };
}

// הדבקה: הורדת הקלף שנמשך הרגע אל ערימת הזריקה, מחוץ לתור.
// הקלף המודבק אינו ניתן למשיכה — זכויות המשיכה של השחקן הבא נשמרות
// על הקלפים שהונחו לפני ההדבקה.
export function slapDown(state: EngineState, playerId: string, cardId: string): Card {
  const win = state.slapWindow;
  if (!win || win.playerId !== playerId) throw new Error('no-slap');
  if (win.cardId !== cardId) throw new Error('wrong-slap-card');
  const player = state.players.find((p) => p.id === playerId);
  const card = player?.hand.find((c) => c.id === cardId);
  if (!player || !card) throw new Error('card-not-in-hand');

  player.hand = player.hand.filter((c) => c.id !== cardId);
  state.discard = [...state.discard, card];
  state.slappedIds = [...state.slappedIds, card.id];
  state.slapWindow = null; // הדבקה אחת לכל היותר
  return card;
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
