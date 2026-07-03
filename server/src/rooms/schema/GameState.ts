// Colyseus schema — ה-state המשותף הנראה לכל הלקוחות (ללא ידיים פרטיות)
import { Schema, type, ArraySchema, MapSchema } from '@colyseus/schema';

export class CardState extends Schema {
  @type('string') id = '';
  @type('string') suit = ''; // '' עבור ג'וקר
  @type('number') rank = 0;
  @type('boolean') joker = false;
  @type('boolean') pickable = false; // האם ניתן להרים קלף זה מהזריקה
  @type('boolean') slapped = false; // קלף שהודבק — מוצג בהיסט, לא ניתן למשיכה
}

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') seat = 0;
  @type('number') handCount = 0;
  @type('number') score = 0;
  @type('boolean') connected = true;
  @type('boolean') isTurn = false;
  @type('boolean') out = false; // הודח
}

// תוצאת סיבוב לחשיפה (כל הידיים מתגלות)
export class RevealCard extends Schema {
  @type('string') id = '';
  @type('string') suit = '';
  @type('number') rank = 0;
  @type('boolean') joker = false;
}

export class PlayerResult extends Schema {
  @type('string') playerId = '';
  @type([RevealCard]) hand = new ArraySchema<RevealCard>();
  @type('number') handValue = 0;
  @type('number') roundScore = 0;
  @type('number') totalScore = 0;
  @type('boolean') eliminated = false;
}

export class RoundResultState extends Schema {
  @type('string') callerId = '';
  @type('number') callerValue = 0;
  @type('boolean') asaf = false;
  @type('string') asafById = '';
  @type('string') winnerId = '';
  @type([PlayerResult]) players = new ArraySchema<PlayerResult>();
}

export class GameState extends Schema {
  @type('string') phase = 'lobby'; // lobby | playing | roundEnd | gameOver
  @type('string') roomCode = '';
  @type('string') hostId = '';
  @type('string') currentTurnId = '';
  @type('number') deckCount = 0;
  @type('number') yanivThreshold = 7;
  @type('number') scoreLimit = 200;
  @type('number') maxPlayers = 4;
  @type('string') gameWinnerId = '';
  @type('string') discardKind = 'single'; // single | set | run — משפיע על פריסת הערימה
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([CardState]) discard = new ArraySchema<CardState>();
  @type(RoundResultState) roundResult = new RoundResultState();
  @type('boolean') hasResult = false;
}
