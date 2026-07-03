// טיפוסים משותפים בין ה-server ל-client — מקור אמת יחיד לצורות הנתונים
// Shared types between server and client — single source of truth for data shapes

export type Suit = 'S' | 'H' | 'D' | 'C'; // עלה, לב, יהלום, תלתן
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

// Rank: 1=Ace ... 13=King. Jokers use rank 0.
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: string; // מזהה ייחודי ליציבות אנימציות (למשל "S7", "JOKER1")
  suit: Suit | null; // null עבור ג'וקר
  rank: Rank; // 0 עבור ג'וקר
  joker: boolean;
}

// סוג הזריקה: קלף בודד / סט / רצף
export type ComboKind = 'single' | 'set' | 'run';

// מקור המשיכה: מהקופה או קלף ספציפי מהזריקה הקודמת
export type DrawSource = 'deck' | 'discard';

// שלב המשחק
export type Phase = 'lobby' | 'playing' | 'roundEnd' | 'gameOver';

// תוצאת פענוח סיבוב לכל שחקן
export interface PlayerRoundResult {
  playerId: string;
  hand: Card[]; // היד נחשפת בסוף הסיבוב
  handValue: number;
  roundScore: number; // כמה נוסף לניקוד השחקן
  totalScore: number; // הניקוד המצטבר אחרי הסיבוב
  eliminated: boolean;
}

export interface RoundResult {
  callerId: string;
  callerValue: number;
  asaf: boolean; // האם הייתה תפיסת אסף
  asafById: string | null; // מי תפס (הסכום הנמוך ביותר שאינו המכריז)
  winnerId: string; // מי זכה בסיבוב (הסכום הנמוך ביותר בפועל)
  players: PlayerRoundResult[];
}

// הגדרות חוקי בית
export interface GameConfig {
  yanivThreshold: number; // ברירת מחדל 7
  scoreLimit: number; // ברירת מחדל 200
  maxPlayers: number; // עד 4
}

export const DEFAULT_CONFIG: GameConfig = {
  yanivThreshold: 7,
  scoreLimit: 200,
  maxPlayers: 4,
};

// ----- הודעות client → server -----
export interface JoinMessage { name: string; }
export interface DiscardMessage {
  cardIds: string[];
  drawSource: DrawSource;
  pickupId?: string; // חובה כאשר drawSource='discard' — איזה קלף בדיוק לוקחים
}
export interface SlapMessage { cardId: string; } // הדבקה
export interface ConfigMessage { config: Partial<GameConfig>; }

// ----- הודעות server → client -----
export const MSG = {
  HAND: 'hand', // יד פרטית לשחקן (נשלח ל-client בודד)
  ERROR: 'error', // פעולה לא חוקית
  ANIM: 'anim', // אירוע אנימציה (זריקה/משיכה/הכרזה/הדבקה)
} as const;

// אירוע אנימציה שהשרת משדר כדי שהלקוחות יסנכרנו תנועות.
// card נכלל במשיכה מהערימה (מידע פומבי!) — כך כולם רואים מה נלקח.
export type AnimEvent =
  | { type: 'discard'; playerId: string; cards: Card[] }
  | { type: 'draw'; playerId: string; source: DrawSource; card?: Card }
  | { type: 'slap'; playerId: string; card: Card }
  | { type: 'yaniv'; playerId: string }
  | { type: 'asaf'; playerId: string }
  | { type: 'deal' };

// יד פרטית שנשלחת רק לבעליה
export interface PrivateHand {
  cards: Card[];
  value: number;
  canYaniv: boolean;
  slapCardId: string | null; // קלף שניתן להדביק עכשיו (מהבהב ביד)
}
