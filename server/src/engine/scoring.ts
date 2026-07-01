// פענוח סיבוב: קביעת מנצח, זיהוי אסף, וחישוב ניקוד לכל שחקן
// Round resolution: winner, Asaf detection, per-player scoring
import { Card } from '../../../shared/types';
import { handValue } from './combos';

// כלל ניקוד מדויק: 100→50, 200→100 (הקלה בדיוק בסף)
export function applyExactScore(score: number): number {
  if (score === 200) return 100;
  if (score === 100) return 50;
  return score;
}

export function isEliminated(score: number, limit = 200): boolean {
  return score > limit;
}

export interface RoundInput {
  playerId: string;
  hand: Card[];
  previousScore: number;
}

export interface RoundOutput {
  callerId: string;
  callerValue: number;
  asaf: boolean;
  asafById: string | null;
  winnerId: string;
  results: {
    playerId: string;
    handValue: number;
    roundScore: number;
    totalScore: number;
    eliminated: boolean;
  }[];
}

// פענוח סיבוב יניב.
// callerId — מי הכריז "יניב".
// אסף: אם לשחקן אחר יש סכום ≤ סכום המכריז (כולל תיקו) → המכריז נענש ב-+30.
export function resolveRound(
  players: RoundInput[],
  callerId: string,
  scoreLimit = 200
): RoundOutput {
  const values = new Map<string, number>();
  for (const p of players) values.set(p.playerId, handValue(p.hand));

  const callerValue = values.get(callerId)!;

  // האם מישהו אחר ≤ המכריז?  (תיקו נחשב אסף לרעת המכריז)
  let asafById: string | null = null;
  let lowestOther = Infinity;
  for (const p of players) {
    if (p.playerId === callerId) continue;
    const v = values.get(p.playerId)!;
    if (v <= callerValue && v < lowestOther) {
      lowestOther = v;
      asafById = p.playerId;
    }
  }
  const asaf = asafById !== null;

  // מנצח הסיבוב = הסכום הנמוך ביותר בפועל (בתיקו-אסף, התופס)
  let winnerId = callerId;
  let lowest = callerValue;
  for (const p of players) {
    const v = values.get(p.playerId)!;
    if (v < lowest) {
      lowest = v;
      winnerId = p.playerId;
    }
  }
  if (asaf) winnerId = asafById!;

  const results = players.map((p) => {
    const hv = values.get(p.playerId)!;
    let roundScore: number;
    if (p.playerId === callerId) {
      roundScore = asaf ? hv + 30 : 0; // הכרזה מוצלחת → 0; אסף → יד + 30
    } else {
      roundScore = hv;
    }
    const total = applyExactScore(p.previousScore + roundScore);
    return {
      playerId: p.playerId,
      handValue: hv,
      roundScore,
      totalScore: total,
      eliminated: isEliminated(total, scoreLimit),
    };
  });

  return { callerId, callerValue, asaf, asafById, winnerId, results };
}
