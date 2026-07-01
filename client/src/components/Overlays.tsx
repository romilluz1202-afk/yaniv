// שכבות-על: הכרזת יניב/אסף, לוח תוצאות סיבוב, ומסך סיום משחק
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNet } from '../net/colyseus';
import { getPlayers } from '../game/state';
import { Card } from './Card';
import { sfx } from '../game/sfx';

// ---- הכרזת יניב / אסף ----
export function Announce() {
  const announce = useNet((s) => s.announce);
  const clearAnnounce = useNet((s) => s.clearAnnounce);
  const room = useNet((s) => s.room)!;

  useEffect(() => {
    if (!announce) return;
    if (announce.type === 'yaniv') sfx.yaniv();
    else sfx.asaf();
    const t = setTimeout(clearAnnounce, 1500);
    return () => clearTimeout(t);
  }, [announce, clearAnnounce]);

  const name = announce
    ? getPlayers(room.state).find((p) => p.id === announce.playerId)?.name || ''
    : '';

  return (
    <AnimatePresence>
      {announce && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, pointerEvents: 'none', background: 'rgba(0,0,0,0.25)' }}
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            style={{ textAlign: 'center' }}
          >
            <div
              style={{
                fontSize: 68,
                fontWeight: 900,
                color: announce.type === 'yaniv' ? 'var(--gold-bright)' : '#ff7a6a',
                textShadow: '0 4px 18px rgba(0,0,0,0.7)',
                letterSpacing: 2,
              }}
            >
              {announce.type === 'yaniv' ? 'יניב!' : 'אסף!'}
            </div>
            <div style={{ fontSize: 20, marginTop: 4, color: 'var(--cream)' }}>{name}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---- לוח תוצאות סיבוב ----
export function RoundResult() {
  const room = useNet((s) => s.room)!;
  const sessionId = useNet((s) => s.sessionId);
  const continueGame = useNet((s) => s.continueGame);
  useNet((s) => s.stateVersion);

  const state = room.state as any;
  const rr = state.roundResult;
  const isHost = state.hostId === sessionId;

  const players = getPlayers(state);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || '';

  // המארח מקדם אוטומטית לסיבוב הבא אחרי 5 שניות (קצב מהיר, ללא מריחה)
  useEffect(() => {
    if (!isHost) return;
    const t = setTimeout(continueGame, 5000);
    return () => clearTimeout(t);
  }, [isHost, continueGame]);

  const results: any[] = [];
  rr.players?.forEach((p: any) => results.push(p));
  results.sort((a, b) => a.totalScore - b.totalScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: 'absolute', inset: 0, zIndex: 25, background: 'rgba(4,26,17,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, gap: 12, overflowY: 'auto' }}
    >
      <h2 className="title-gold" style={{ fontSize: 26, marginTop: 8 }}>
        {rr.asaf ? 'אסף! 🎯' : 'יניב! 🏆'}
      </h2>
      <p style={{ margin: 0, fontSize: 15, opacity: 0.85, textAlign: 'center' }}>
        {rr.asaf
          ? `${nameOf(rr.callerId)} הכריז אבל ל${nameOf(rr.asafById)} היה פחות`
          : `${nameOf(rr.winnerId)} זכה בסיבוב`}
      </p>

      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {results.map((r: any) => {
          const hand: any[] = [];
          r.hand?.forEach((c: any) => hand.push(c));
          const isWinner = r.playerId === rr.winnerId;
          return (
            <div
              key={r.playerId}
              style={{
                background: isWinner ? 'rgba(202,160,74,0.18)' : 'rgba(0,0,0,0.3)',
                border: `1.5px solid ${isWinner ? 'var(--gold-bright)' : 'var(--gold-dim)'}`,
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>
                  {nameOf(r.playerId)} {r.eliminated && <span style={{ color: '#ff8f7f', fontSize: 12 }}>· הודח</span>}
                </span>
                <span style={{ fontSize: 13 }}>
                  <span style={{ color: r.roundScore > 0 ? '#ff9a8a' : 'var(--gold-bright)' }}>
                    +{r.roundScore}
                  </span>{' '}
                  <span style={{ opacity: 0.6 }}>→ {r.totalScore}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {hand.map((c: any) => (
                  <Card key={c.id} card={{ id: c.id, suit: c.suit || null, rank: c.rank, joker: c.joker }} w={30} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />
      {isHost ? (
        <button className="btn-gold pulse" style={{ maxWidth: 340, width: '100%' }} onClick={continueGame}>
          סיבוב הבא
        </button>
      ) : (
        <div style={{ opacity: 0.8, padding: 12 }}>ממתין למארח לסיבוב הבא…</div>
      )}
    </motion.div>
  );
}

// ---- סיום משחק ----
export function GameOver() {
  const room = useNet((s) => s.room)!;
  const leave = useNet((s) => s.leave);
  useNet((s) => s.stateVersion);

  const state = room.state as any;
  const players = getPlayers(state).sort((a, b) => a.score - b.score);
  const winner = players.find((p) => p.id === state.gameWinnerId) || players[0];

  useEffect(() => {
    sfx.win();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(4,26,17,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}
    >
      <div style={{ fontSize: 60 }}>🏆</div>
      <h1 className="title-gold" style={{ fontSize: 36 }}>{winner?.name} ניצח!</h1>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--gold-dim)', borderRadius: 10, padding: '10px 14px' }}>
            <span>{i + 1}. {p.name}</span>
            <span style={{ color: 'var(--gold-bright)' }}>{p.score} נק'</span>
          </div>
        ))}
      </div>
      <button className="btn-gold" style={{ maxWidth: 320, width: '100%', marginTop: 12 }} onClick={leave}>
        חזרה לתפריט
      </button>
    </motion.div>
  );
}
