import { describe, it, expect } from 'vitest';
import { Card, Rank, Suit } from '../../../shared/types';
import { createDeck, cardValue, shuffle } from './deck';
import {
  handValue,
  canCallYaniv,
  validateDiscard,
  pickableCards,
  orderForDiscard,
} from './combos';
import { resolveRound, applyExactScore, isEliminated } from './scoring';
import { createGame, startRound, discardAndDraw, currentPlayer, canYaniv } from './round';

// עזר ליצירת קלף לבדיקות
function card(suit: Suit | null, rank: Rank, joker = false): Card {
  return { id: joker ? `J${rank}${Math.random()}` : `${suit}${rank}`, suit, rank, joker };
}
const J = (): Card => ({ id: `JOKER${Math.random()}`, suit: null, rank: 0, joker: true });

describe('deck', () => {
  it('creates 54 cards including 2 jokers', () => {
    const d = createDeck();
    expect(d.length).toBe(54);
    expect(d.filter((c) => c.joker).length).toBe(2);
  });
  it('all card ids are unique', () => {
    const ids = new Set(createDeck().map((c) => c.id));
    expect(ids.size).toBe(54);
  });
  it('card values: ace=1, faces=10, joker=0', () => {
    expect(cardValue(card('S', 1))).toBe(1);
    expect(cardValue(card('S', 7))).toBe(7);
    expect(cardValue(card('S', 11))).toBe(10);
    expect(cardValue(card('S', 13))).toBe(10);
    expect(cardValue(J())).toBe(0);
  });
  it('seeded shuffle is deterministic', () => {
    const a = shuffle(createDeck(), 42).map((c) => c.id);
    const b = shuffle(createDeck(), 42).map((c) => c.id);
    expect(a).toEqual(b);
  });
});

describe('handValue & yaniv threshold', () => {
  it('sums a hand', () => {
    expect(handValue([card('S', 3), card('H', 4), J()])).toBe(7);
  });
  it('canCallYaniv respects threshold 7 (default)', () => {
    expect(canCallYaniv([card('S', 3), card('H', 4)])).toBe(true); // 7
    expect(canCallYaniv([card('S', 5), card('H', 3)])).toBe(false); // 8
  });
  it('canCallYaniv with threshold 5', () => {
    expect(canCallYaniv([card('S', 3), card('H', 4)], 5)).toBe(false); // 7 > 5
    expect(canCallYaniv([card('S', 2), card('H', 3)], 5)).toBe(true); // 5
  });
});

describe('validateDiscard', () => {
  it('single card is valid', () => {
    expect(validateDiscard([card('S', 7)])).toMatchObject({ valid: true, kind: 'single' });
  });
  it('set of same rank valid', () => {
    expect(validateDiscard([card('S', 9), card('H', 9)])).toMatchObject({ valid: true, kind: 'set' });
    expect(validateDiscard([card('S', 5), card('H', 5), card('D', 5)])).toMatchObject({ kind: 'set' });
  });
  it('two different ranks is invalid', () => {
    expect(validateDiscard([card('S', 9), card('H', 8)]).valid).toBe(false);
  });
  it('run of 3 same suit valid', () => {
    expect(
      validateDiscard([card('S', 4), card('S', 5), card('S', 6)])
    ).toMatchObject({ valid: true, kind: 'run' });
  });
  it('run must be same suit', () => {
    expect(validateDiscard([card('S', 4), card('H', 5), card('S', 6)]).valid).toBe(false);
  });
  it('run of 2 is invalid (min 3)', () => {
    expect(validateDiscard([card('S', 4), card('S', 5)]).valid).toBe(false);
  });
  it('ace is low: A-2-3 valid, Q-K-A invalid', () => {
    expect(validateDiscard([card('S', 1), card('S', 2), card('S', 3)]).valid).toBe(true);
    expect(validateDiscard([card('S', 12), card('S', 13), card('S', 1)]).valid).toBe(false);
  });
  it('joker fills a gap in a run', () => {
    // 5, joker(=6), 7 same suit
    expect(validateDiscard([card('S', 5), J(), card('S', 7)]).valid).toBe(true);
    // joker on the end: 5,6,joker(=7)
    expect(validateDiscard([card('S', 5), card('S', 6), J()]).valid).toBe(true);
  });
  it('non-consecutive same suit is not a run', () => {
    expect(validateDiscard([card('S', 4), card('S', 6), card('S', 9)]).valid).toBe(false);
  });
});

describe('pickableCards / orderForDiscard', () => {
  it('single: the one card', () => {
    const c = card('S', 7);
    expect(pickableCards([c]).map((x) => x.id)).toEqual(['S7']);
  });
  it('run: only first and last ends', () => {
    const run = orderForDiscard([card('S', 6), card('S', 4), card('S', 5)], 'run');
    expect(run.map((c) => c.rank)).toEqual([4, 5, 6]);
    const ends = pickableCards(run).map((c) => c.rank);
    expect(ends).toEqual([4, 6]);
  });
  it('set: two ends', () => {
    const set = [card('S', 9), card('H', 9), card('D', 9)];
    expect(pickableCards(set).length).toBe(2);
  });
});

describe('scoring / resolveRound', () => {
  const P = (id: string, hand: Card[], previousScore = 0) => ({ playerId: id, hand, previousScore });

  it('valid yaniv: caller lowest scores 0, others add their hand', () => {
    const r = resolveRound(
      [P('a', [card('S', 2), card('H', 3)]), P('b', [card('S', 10), card('H', 5)])],
      'a'
    );
    expect(r.asaf).toBe(false);
    expect(r.winnerId).toBe('a');
    const a = r.results.find((x) => x.playerId === 'a')!;
    const b = r.results.find((x) => x.playerId === 'b')!;
    expect(a.roundScore).toBe(0);
    expect(b.roundScore).toBe(15);
  });

  it('asaf: another player strictly lower -> caller +30 + hand', () => {
    const r = resolveRound(
      [P('a', [card('S', 5)]), P('b', [card('S', 2)])],
      'a'
    );
    expect(r.asaf).toBe(true);
    expect(r.asafById).toBe('b');
    expect(r.winnerId).toBe('b');
    const a = r.results.find((x) => x.playerId === 'a')!;
    expect(a.roundScore).toBe(5 + 30);
  });

  it('tie counts as asaf against caller', () => {
    const r = resolveRound(
      [P('a', [card('S', 5)]), P('b', [card('S', 5)])],
      'a'
    );
    expect(r.asaf).toBe(true);
    const a = r.results.find((x) => x.playerId === 'a')!;
    expect(a.roundScore).toBe(35);
  });

  it('exact score rule 100->50 and 200->100', () => {
    expect(applyExactScore(100)).toBe(50);
    expect(applyExactScore(200)).toBe(100);
    expect(applyExactScore(99)).toBe(99);
  });

  it('applies exact-score halving through resolveRound totals', () => {
    // b previously 90, adds 10 -> exactly 100 -> becomes 50
    const r = resolveRound(
      [P('a', [card('S', 1)]), P('b', [card('S', 10)], 90)],
      'a'
    );
    const b = r.results.find((x) => x.playerId === 'b')!;
    expect(b.totalScore).toBe(50);
  });

  it('elimination above limit', () => {
    expect(isEliminated(201, 200)).toBe(true);
    expect(isEliminated(200, 200)).toBe(false);
  });
});

describe('round flow', () => {
  it('deals 5 cards each and one starting discard', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], undefined, 1);
    startRound(g);
    expect(g.players[0].hand.length).toBe(5);
    expect(g.players[1].hand.length).toBe(5);
    expect(g.discard.length).toBe(1);
    // 54 - 10 - 1 = 43 in deck
    expect(g.deck.length).toBe(43);
  });

  it('discard + draw keeps hand size and advances turn', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], undefined, 1);
    startRound(g);
    const p = currentPlayer(g);
    const toss = p.hand[0];
    const before = p.hand.length;
    discardAndDraw(g, p.id, [toss.id], 'deck');
    expect(p.hand.length).toBe(before); // -1 discard +1 draw
    expect(g.discard[0].id).toBe(toss.id);
    expect(currentPlayer(g).id).not.toBe(p.id);
  });

  it('rejects playing out of turn', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], undefined, 1);
    startRound(g);
    const notCurrent = g.players.find((p) => p.id !== currentPlayer(g).id)!;
    expect(() => discardAndDraw(g, notCurrent.id, [notCurrent.hand[0].id], 'deck')).toThrow();
  });

  it('can pick up a card from the previous discard end', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], undefined, 1);
    startRound(g);
    const prevTop = g.discard[g.discard.length - 1];
    const p = currentPlayer(g);
    discardAndDraw(g, p.id, [p.hand[0].id], 'discard-last');
    expect(p.hand.some((c) => c.id === prevTop.id)).toBe(true);
  });

  it('conserves 54 cards and reshuffles pile when deck empties (long game)', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], undefined, 7);
    startRound(g);
    const count = () =>
      g.players.reduce((s, p) => s + p.hand.length, 0) + g.deck.length + g.discard.length + g.pile.length;
    expect(count()).toBe(54);
    let reshuffled = false;
    for (let i = 0; i < 200; i++) {
      const p = currentPlayer(g);
      // זרוק את הקלף הגבוה, משוך מהקופה — אמור לעבוד גם אחרי שהקופה נגמרת
      let worst = p.hand[0];
      for (const c of p.hand) if ((c.joker ? 0 : c.rank) > (worst.joker ? 0 : worst.rank)) worst = c;
      const deckBefore = g.deck.length;
      expect(() => discardAndDraw(g, p.id, [worst.id], 'deck')).not.toThrow();
      if (deckBefore === 0 && g.deck.length > 0) reshuffled = true;
      expect(count()).toBe(54); // שימור בכל צעד
    }
    expect(reshuffled).toBe(true);
  });

  it('canYaniv true only for current player under threshold', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], undefined, 1);
    startRound(g);
    const p = currentPlayer(g);
    p.hand = [card('S', 2), card('H', 3)]; // 5
    expect(canYaniv(g, p.id)).toBe(true);
    const other = g.players.find((x) => x.id !== p.id)!;
    expect(canYaniv(g, other.id)).toBe(false);
  });
});
