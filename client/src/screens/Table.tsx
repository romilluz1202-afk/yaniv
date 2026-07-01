// מסך השולחן — יריבים, קופה+זריקה, היד שלי, וסוללת פעולות
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNet } from '../net/colyseus';
import { getPlayers, getDiscard } from '../game/state';
import { isValidSelection } from '../game/combo';
import { heError } from '../game/messages';
import { Card } from '../components/Card';
import { OpponentSeat } from '../components/OpponentSeat';
import { Announce, RoundResult, GameOver } from '../components/Overlays';
import { sfx, setMuted, isMuted } from '../game/sfx';
import type { DrawSource, Suit } from '@shared/types';

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3 };

export function Table() {
  const room = useNet((s) => s.room)!;
  const sessionId = useNet((s) => s.sessionId);
  const hand = useNet((s) => s.hand);
  const handValue = useNet((s) => s.handValue);
  const canYaniv = useNet((s) => s.canYaniv);
  const discardAction = useNet((s) => s.discard);
  const callYaniv = useNet((s) => s.callYaniv);
  const error = useNet((s) => s.error);
  const clearError = useNet((s) => s.clearError);
  useNet((s) => s.stateVersion);

  const [selected, setSelected] = useState<string[]>([]);
  const [muted, setMutedState] = useState(isMuted());

  const state = room.state as any;
  const phase: string = state.phase;
  const players = getPlayers(state);
  const opponents = players.filter((p) => p.id !== sessionId);
  const myTurn = phase === 'playing' && state.currentTurnId === sessionId;
  const discard = getDiscard(state);

  // ניקוי בחירה כשמתחלף התור או משתנה היד
  useEffect(() => {
    setSelected([]);
  }, [state.currentTurnId, hand]);

  // הצגת שגיאה זמנית
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 2200);
    return () => clearTimeout(t);
  }, [error, clearError]);

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

  const toggle = (id: string) => {
    if (!myTurn) return;
    sfx.flip();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const doDiscard = (source: DrawSource) => {
    if (!myTurn || !selectionValid) return;
    sfx.draw();
    discardAction(selected, source);
    setSelected([]);
  };

  // אינדקסים של קצות ניתנים למשיכה
  const pickableIdx = discard.map((c, i) => (c.pickable ? i : -1)).filter((i) => i >= 0);
  const firstPick = pickableIdx[0];
  const lastPick = pickableIdx[pickableIdx.length - 1];

  const tapDiscardCard = (idx: number) => {
    if (!myTurn) return;
    if (!selectionValid) return; // חייב לבחור צירוף לזריקה קודם
    const source: DrawSource = idx === firstPick ? 'discard-first' : 'discard-last';
    doDiscard(source);
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
      {/* סרגל עליון */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13 }}>
        <span style={{ opacity: 0.6 }}>חדר {state.roomCode}</span>
        <span style={{ fontWeight: 700, color: myTurn ? 'var(--gold-bright)' : 'var(--text-light)' }}>
          {myTurn ? 'תורך!' : `תור ${players.find((p) => p.id === state.currentTurnId)?.name || ''}`}
        </span>
        <button onClick={toggleMute} style={{ fontSize: 18, opacity: 0.7 }}>{muted ? '🔇' : '🔊'}</button>
      </div>

      {/* יריבים */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '4px 6px', gap: 4 }}>
        {opponents.map((p) => (
          <OpponentSeat key={p.id} p={p} />
        ))}
      </div>

      {/* מרכז — קופה + זריקה */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          {/* קופה */}
          <div style={{ textAlign: 'center' }}>
            <motion.div whileTap={myTurn && selectionValid ? { scale: 0.94 } : undefined} onClick={() => doDiscard('deck')} style={{ cursor: myTurn && selectionValid ? 'pointer' : 'default', position: 'relative' }}>
              <Card faceDown w={62} pickable={myTurn && selectionValid} />
              {state.deckCount > 1 && (
                <div style={{ position: 'absolute', top: -3, insetInlineStart: -3, width: '100%', height: '100%', zIndex: -1 }}>
                  <Card faceDown w={62} />
                </div>
              )}
            </motion.div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>קופה ({state.deckCount})</div>
          </div>

          {/* זריקה */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', minHeight: 87, alignItems: 'center' }}>
              <AnimatePresence mode="popLayout">
                {discard.map((c: any, i: number) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    style={{ marginInlineStart: i === 0 ? 0 : -18 }}
                  >
                    <Card
                      card={{ id: c.id, suit: c.suit || null, rank: c.rank, joker: c.joker }}
                      w={62}
                      pickable={myTurn && selectionValid && c.pickable}
                      dimmed={myTurn && selectionValid && !c.pickable}
                      onClick={c.pickable ? () => tapDiscardCard(i) : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>זריקה</div>
          </div>
        </div>

        {/* רמז פעולה */}
        <div style={{ fontSize: 12.5, opacity: 0.85, height: 18, textAlign: 'center', padding: '0 20px' }}>
          {!myTurn
            ? ''
            : selectionValid
            ? 'הקש על הקופה למשיכה, או על קלף מודגש בערימה'
            : 'בחר קלף בודד, סט, או רצף לזריקה'}
        </div>
      </div>

      {/* שגיאה צפה */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', bottom: 190, insetInlineStart: '50%', transform: 'translateX(50%)', background: 'rgba(150,30,20,0.9)', color: '#ffe2da', padding: '8px 16px', borderRadius: 10, fontSize: 13, zIndex: 20, whiteSpace: 'nowrap' }}
          >
            {heError(error)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* היד שלי */}
      <div style={{ padding: '6px 8px 4px', background: 'linear-gradient(0deg, rgba(0,0,0,0.28), transparent)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2, minHeight: 92 }}>
          {sortedHand.map((c) => (
            <div key={c.id} style={{ marginInlineStart: -6 }}>
              <Card
                card={c}
                w={56}
                selected={selected.includes(c.id)}
                onClick={() => toggle(c.id)}
                dimmed={!myTurn}
              />
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, marginTop: 2, opacity: 0.85 }}>
          היד שלך · <b style={{ color: 'var(--gold-bright)' }}>{handValue}</b> נק'
        </div>
      </div>

      {/* סוללת פעולות */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 12px 14px' }}>
        <button
          className={'btn-gold ' + (myTurn && canYaniv && selected.length === 0 ? 'pulse' : '')}
          style={{ flex: 1 }}
          disabled={!myTurn || !canYaniv || selected.length > 0}
          onClick={callYaniv}
        >
          יניב! {myTurn && canYaniv ? `(${handValue})` : ''}
        </button>
        {selected.length > 0 && (
          <button className="btn-ghost" onClick={() => setSelected([])}>
            בטל בחירה
          </button>
        )}
      </div>

      {/* שכבות-על */}
      <Announce />
      {phase === 'roundEnd' && <RoundResult />}
      {phase === 'gameOver' && <GameOver />}
    </div>
  );
}
