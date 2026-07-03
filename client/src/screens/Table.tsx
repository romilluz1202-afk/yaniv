// מסך השולחן — יריבים, קופה+זריקה, היד שלי, מעופי קלפים, חשיפה וניקוד.
// זרימת סוף סיבוב: הכרזה קולית → חשיפת ידיים בשולחן (~5ש') → טבלת ניקוד.
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNet } from '../net/colyseus';
import { getPlayers, getDiscard } from '../game/state';
import { isValidSelection } from '../game/combo';
import { heError } from '../game/messages';
import { Card } from '../components/Card';
import { OpponentSeat, SeatReveal } from '../components/OpponentSeat';
import { Announce, ScorePanel, GameOver } from '../components/Overlays';
import { FlyProvider, useFly } from '../fx/FlyLayer';
import { sfx, setMuted, isMuted, buzz } from '../game/sfx';
import type { Card as TCard, Suit, AnimEvent } from '@shared/types';

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3 };
const REVEAL_MS = 5200; // כמה זמן נשארים בזווית השולחן עם הידיים החשופות

const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const cardLabel = (c: TCard) => {
  if (c.joker) return 'ג\'וקר';
  const lab = RANK_LABELS[c.rank] || String(c.rank);
  const glyph = { S: '♠', H: '♥', D: '♦', C: '♣' }[c.suit as Suit];
  return `${lab}${glyph}`;
};

export function Table() {
  return (
    <FlyProvider>
      <TableInner />
    </FlyProvider>
  );
}

function TableInner() {
  const room = useNet((s) => s.room)!;
  const sessionId = useNet((s) => s.sessionId);
  const hand = useNet((s) => s.hand);
  const handValue = useNet((s) => s.handValue);
  const canYaniv = useNet((s) => s.canYaniv);
  const slapCardId = useNet((s) => s.slapCardId);
  const discardAction = useNet((s) => s.discard);
  const slapAction = useNet((s) => s.slap);
  const callYaniv = useNet((s) => s.callYaniv);
  const error = useNet((s) => s.error);
  const errorSeq = useNet((s) => s.errorSeq);
  const clearError = useNet((s) => s.clearError);
  const animSeq = useNet((s) => s.animSeq);
  useNet((s) => s.stateVersion);

  const { fly, register } = useFly();
  const [selected, setSelected] = useState<string[]>([]);
  const [muted, setMutedState] = useState(isMuted());
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [stage, setStage] = useState<'play' | 'reveal' | 'score'>('play');
  const prevTurnRef = useRef('');

  const state = room.state as any;
  const phase: string = state.phase;
  const players = getPlayers(state);
  const me = players.find((p) => p.id === sessionId);
  const opponents = players.filter((p) => p.id !== sessionId);
  const myTurn = phase === 'playing' && state.currentTurnId === sessionId;
  const discard = getDiscard(state);
  const discardKind: string = state.discardKind;

  // ---- מכונת שלבים לסוף סיבוב: חשיפה בשולחן → טבלת ניקוד ----
  useEffect(() => {
    if (phase === 'playing') {
      setStage('play');
      return;
    }
    if (phase === 'roundEnd' || phase === 'gameOver') {
      setStage('reveal');
      const t = setTimeout(() => setStage('score'), REVEAL_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // צליל "תורך" כשהתור מגיע אליי
  useEffect(() => {
    if (myTurn && prevTurnRef.current !== sessionId) {
      sfx.yourTurn();
      buzz(20);
    }
    prevTurnRef.current = state.currentTurnId;
  }, [myTurn, state.currentTurnId, sessionId]);

  // ניקוי בחירה כשמתחלף התור או משתנה היד
  useEffect(() => {
    setSelected([]);
  }, [state.currentTurnId, hand]);

  // הצגת שגיאה זמנית + רעידת יד
  useEffect(() => {
    if (!error) return;
    buzz([40, 30, 40]);
    const t = setTimeout(clearError, 2200);
    return () => clearTimeout(t);
  }, [error, errorSeq, clearError]);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || '';
  const zoneOf = (playerId: string) => (playerId === sessionId ? 'myhand' : `seat-${playerId}`);

  // ---- תרגום אירועי רשת למעופי קלפים + כרזות ----
  useEffect(() => {
    const ev = useNet.getState().lastAnim as AnimEvent | null;
    if (!ev) return;
    switch (ev.type) {
      case 'deal': {
        const ps = getPlayers(useNet.getState().room!.state);
        ps.forEach((p, pi) => {
          for (let i = 0; i < 5; i++) {
            fly({
              from: 'deck',
              to: zoneOf(p.id),
              faceDown: true,
              w: p.id === sessionId ? 50 : 24,
              delay: (pi * 5 + i) * 65,
              dur: 0.42,
              spin: -10,
              arc: 40,
            });
            if (i === 0) setTimeout(() => sfx.deal(), pi * 5 * 65);
          }
        });
        break;
      }
      case 'discard': {
        sfx.flip();
        ev.cards.forEach((c, i) =>
          fly({ card: c, from: zoneOf(ev.playerId), to: 'discard', w: 58, delay: i * 70, dur: 0.42, spin: 8, arc: 46 })
        );
        break;
      }
      case 'draw': {
        sfx.draw();
        if (ev.source === 'deck') {
          // משיכה חסויה מהקופה — גב קלף עף לשחקן
          fly({ from: 'deck', to: zoneOf(ev.playerId), faceDown: true, w: 52, dur: 0.48, arc: 44 });
          if (ev.playerId !== sessionId)
            setToast({ text: `${nameOf(ev.playerId)} משך מהקופה 🂠`, key: Date.now() });
        } else if (ev.card) {
          // משיכה פומבית מהערימה — הקלף האמיתי עף, וכולם רואים מה נלקח
          fly({ card: ev.card, from: 'discard', to: zoneOf(ev.playerId), w: 58, dur: 0.55, arc: 52 });
          if (ev.playerId !== sessionId)
            setToast({ text: `${nameOf(ev.playerId)} לקח ${cardLabel(ev.card)} מהערימה!`, key: Date.now() });
        }
        break;
      }
      case 'slap': {
        sfx.slap();
        buzz(50);
        fly({ card: ev.card, from: zoneOf(ev.playerId), to: 'discard', w: 58, dur: 0.32, spin: 16, arc: 30 });
        setToast({ text: `⚡ ${nameOf(ev.playerId)} הדביק ${cardLabel(ev.card)}!`, key: Date.now() });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animSeq]);

  // כרזה נעלמת אחרי 3.5 שניות
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const sortedHand = useMemo(
    () =>
      [...hand].sort((a, b) => {
        const sa = a.joker ? 9 : SUIT_ORDER[a.suit as Suit];
        const sb = b.joker ? 9 : SUIT_ORDER[b.suit as Suit];
        return sa - sb || a.rank - b.rank;
      }),
    [hand]
  );

  const selectedCards = hand.filter((c) => selected.includes(c.id));
  const selectionValid = selectedCards.length > 0 && isValidSelection(selectedCards);

  const toggle = (c: TCard) => {
    // קלף הדבקה מהבהב — לחיצה עליו מדביקה, גם כשלא תורי
    if (slapCardId && c.id === slapCardId) {
      slapAction(c.id);
      return;
    }
    if (!myTurn) return;
    sfx.flip();
    buzz(12);
    setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]));
  };

  const doDiscard = (source: 'deck' | 'discard', pickupId?: string) => {
    if (!myTurn || !selectionValid) return;
    buzz(25);
    discardAction(selected, source, pickupId);
    setSelected([]);
  };

  // ---- נתוני חשיפה לסוף סיבוב ----
  const revealMap = useMemo(() => {
    if (!state.hasResult || stage === 'play') return null;
    const rr = state.roundResult;
    const map = new Map<string, SeatReveal>();
    rr.players?.forEach((pr: any) => {
      const cards: TCard[] = [];
      pr.hand?.forEach((c: any) => cards.push({ id: c.id, suit: c.suit || null, rank: c.rank, joker: c.joker }));
      let badge: SeatReveal['badge'] = null;
      if (pr.playerId === rr.callerId) badge = rr.asaf ? 'asaf' : 'yaniv';
      else if (pr.playerId === rr.winnerId) badge = 'winner';
      map.set(pr.playerId, { cards, value: pr.handValue, delta: pr.roundScore, badge, out: pr.eliminated });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hasResult, stage, phase]);

  const myReveal = revealMap?.get(sessionId);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
  };

  const showReveal = stage === 'reveal';
  const showScore = stage === 'score';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%', overflow: 'hidden' }}>
      {/* סרגל עליון */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13 }}>
        <span style={{ opacity: 0.6 }}>חדר {state.roomCode}</span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={myTurn ? 'me' : state.currentTurnId}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            style={{ fontWeight: 700, color: myTurn ? 'var(--gold-bright)' : 'var(--text-light)' }}
          >
            {phase !== 'playing' ? 'סוף סיבוב' : myTurn ? '✨ תורך!' : `תור ${nameOf(state.currentTurnId)}`}
          </motion.span>
        </AnimatePresence>
        <button onClick={toggleMute} style={{ fontSize: 18, opacity: 0.7 }}>{muted ? '🔇' : '🔊'}</button>
      </div>

      {/* יריבים */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '2px 6px', gap: 4 }}>
        {opponents.map((p) => (
          <div key={p.id} ref={register(`seat-${p.id}`)}>
            <OpponentSeat p={p} reveal={revealMap?.get(p.id) || null} />
          </div>
        ))}
      </div>

      {/* כרזת פעולה (מי לקח מה) */}
      <div style={{ height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.key}
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid var(--gold-dim)',
                borderRadius: 20,
                padding: '4px 14px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--gold-bright)',
              }}
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* מרכז — קופה + זריקה */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {showReveal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold-bright)', background: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: '6px 18px', border: '1px solid var(--gold-dim)' }}
          >
            {state.roundResult.asaf
              ? `${nameOf(state.roundResult.asafById)} תפס אסף על ${nameOf(state.roundResult.callerId)}!`
              : `${nameOf(state.roundResult.callerId)} הכריז יניב על ${state.roundResult.callerValue} נק'`}
          </motion.div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          {/* קופה */}
          <div style={{ textAlign: 'center' }}>
            <motion.div
              ref={register('deck')}
              whileTap={myTurn && selectionValid ? { scale: 0.93 } : undefined}
              animate={myTurn && selectionValid ? { y: [0, -4, 0] } : {}}
              transition={{ repeat: myTurn && selectionValid ? Infinity : 0, duration: 1.4 }}
              onClick={() => doDiscard('deck')}
              style={{ cursor: myTurn && selectionValid ? 'pointer' : 'default', position: 'relative', width: 62 }}
            >
              <div style={{ position: 'absolute', top: -3, insetInlineStart: -3 }}>
                {state.deckCount > 1 && <Card faceDown w={62} />}
              </div>
              <Card faceDown w={62} pickable={myTurn && selectionValid} />
            </motion.div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>קופה · {state.deckCount}</div>
          </div>

          {/* זריקה — סט נפרש, רצף חופף, הדבקה בהיסט */}
          <div style={{ textAlign: 'center' }}>
            <div ref={register('discard')} style={{ display: 'flex', minHeight: 87, alignItems: 'center', justifyContent: 'center', minWidth: 66 }}>
              <AnimatePresence mode="popLayout">
                {discard.map((c: any, i: number) => {
                  const isSlapped = c.slapped;
                  const overlap = discardKind === 'set' ? 6 : -16;
                  return (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ scale: 0.5, opacity: 0, y: -14 }}
                      animate={{ scale: 1, opacity: 1, y: isSlapped ? -8 : 0, rotate: isSlapped ? 12 : 0 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ delay: 0.28, type: 'spring', stiffness: 380, damping: 26 }}
                      style={{ marginInlineStart: i === 0 ? 0 : overlap, position: 'relative', zIndex: i }}
                    >
                      <Card
                        card={{ id: c.id, suit: c.suit || null, rank: c.rank, joker: c.joker }}
                        w={60}
                        pickable={myTurn && selectionValid && c.pickable}
                        dimmed={myTurn && selectionValid && !c.pickable}
                        onClick={c.pickable ? () => doDiscard('discard', c.id) : undefined}
                      />
                      {isSlapped && (
                        <div style={{ position: 'absolute', top: -14, insetInlineStart: '50%', transform: 'translateX(50%)', fontSize: 9.5, fontWeight: 700, background: 'var(--gold)', color: '#2a2006', borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                          ⚡ הדבקה
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>זריקה</div>
          </div>
        </div>

        {/* רמז פעולה */}
        <div style={{ fontSize: 12.5, opacity: 0.85, height: 18, textAlign: 'center', padding: '0 20px' }}>
          {slapCardId
            ? '⚡ הדבקה! לחץ על הקלף המהבהב'
            : !myTurn || phase !== 'playing'
            ? ''
            : selectionValid
            ? 'משוך מהקופה, או קח קלף מודגש מהערימה'
            : 'בחר קלף בודד, סט, או רצף לזריקה'}
        </div>
      </div>

      {/* שגיאה צפה */}
      <AnimatePresence>
        {error && (
          <motion.div
            key={errorSeq}
            initial={{ opacity: 0, y: 10, x: '50%' }}
            animate={{ opacity: 1, y: 0, x: '50%' }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', bottom: 195, insetInlineStart: '50%', background: 'rgba(150,30,20,0.92)', color: '#ffe2da', padding: '8px 16px', borderRadius: 10, fontSize: 13, zIndex: 20, whiteSpace: 'nowrap' }}
          >
            {heError(error)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* היד שלי */}
      <motion.div
        key={errorSeq || 'hand'}
        animate={error ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        style={{ padding: '6px 8px 2px', background: 'linear-gradient(0deg, rgba(0,0,0,0.3), transparent)' }}
      >
        <div ref={register('myhand')} style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: 96, paddingTop: 16, paddingBottom: 10 }}>
          <AnimatePresence mode="popLayout">
            {sortedHand.map((c, i) => {
              const mid = (sortedHand.length - 1) / 2;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ y: 46, opacity: 0, scale: 0.7 }}
                  animate={{ y: Math.abs(i - mid) * 4, opacity: 1, scale: 1, rotate: (i - mid) * 3.5 }}
                  exit={{ y: -30, opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28, delay: i * 0.04 }}
                  style={{ marginInlineStart: i === 0 ? 0 : -12 }}
                >
                  <Card
                    card={c}
                    w={58}
                    selected={selected.includes(c.id)}
                    blink={c.id === slapCardId}
                    onClick={() => toggle(c)}
                    dimmed={phase === 'playing' && !myTurn && c.id !== slapCardId}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, marginTop: 4, opacity: 0.9, display: 'flex', justifyContent: 'center', gap: 14, alignItems: 'center' }}>
          <span>
            היד שלך · <b style={{ color: 'var(--gold-bright)' }}>{handValue}</b> נק'
          </span>
          <span style={{ background: 'var(--gold)', color: '#2a2006', fontWeight: 700, borderRadius: 8, padding: '1px 10px', fontSize: 12 }}>
            סה"כ: {me?.score ?? 0}
          </span>
          {showReveal && myReveal && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 400 }}
              style={{ fontWeight: 700, color: myReveal.delta > 0 ? '#ff9a8a' : 'var(--gold-bright)' }}
            >
              <span style={{ direction: 'ltr', display: 'inline-block' }}>
                {myReveal.delta > 0 ? `+${myReveal.delta}` : '0'}
              </span>
              {myReveal.badge === 'asaf' && ' 💥'}
              {myReveal.badge === 'yaniv' && ' 🏆 ניצחת!'}
              {myReveal.badge === 'winner' && ' 🏆'}
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* סוללת פעולות */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 12px 14px' }}>
        <motion.button
          className={'btn-gold ' + (myTurn && canYaniv && selected.length === 0 ? 'pulse' : '')}
          style={{ flex: 1 }}
          disabled={!myTurn || !canYaniv || selected.length > 0}
          onClick={() => { buzz([40, 30, 80]); callYaniv(); }}
          whileTap={{ scale: 0.97 }}
        >
          יניב! {myTurn && canYaniv ? `(${handValue})` : ''}
        </motion.button>
        {selected.length > 0 && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="btn-ghost" onClick={() => setSelected([])}>
            בטל
          </motion.button>
        )}
      </div>

      {/* שכבות-על */}
      <Announce />
      {showScore && phase === 'roundEnd' && <ScorePanel />}
      {showScore && phase === 'gameOver' && <GameOver />}
    </div>
  );
}
