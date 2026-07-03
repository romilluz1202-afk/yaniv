// שכבות-על: הכרזת יניב/אסף (עם קול), טבלת ניקוד עם ספירה חיה, ומסך סיום משחק
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNet } from '../net/colyseus';
import { getPlayers } from '../game/state';
import { sfx, buzz } from '../game/sfx';

// ספירה חיה של מספר (ease-out)
function useCountUp(target: number, dur = 900, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur, delay]);
  return v;
}

// ---- הכרזת יניב / אסף — פס דרמטי חוצה מסך + קול ----
export function Announce() {
  const announce = useNet((s) => s.announce);
  const clearAnnounce = useNet((s) => s.clearAnnounce);
  const room = useNet((s) => s.room)!;

  useEffect(() => {
    if (!announce) return;
    if (announce.type === 'yaniv') {
      sfx.yaniv();
      buzz([60, 40, 120]);
    } else {
      sfx.asaf();
      buzz([120, 60, 200]);
    }
    const t = setTimeout(clearAnnounce, 1800);
    return () => clearTimeout(t);
  }, [announce, clearAnnounce]);

  const name = announce
    ? getPlayers(room.state).find((p) => p.id === announce.playerId)?.name || ''
    : '';
  const isAsaf = announce?.type === 'asaf';

  return (
    <AnimatePresence>
      {announce && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, pointerEvents: 'none' }}
        >
          {/* פס אלכסוני חוצה מסך */}
          <motion.div
            initial={{ x: '110%', skewX: -8 }}
            animate={{ x: 0, skewX: -8 }}
            exit={{ x: '-110%' }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            style={{
              position: 'absolute',
              insetInline: -30,
              height: 130,
              background: isAsaf
                ? 'linear-gradient(90deg, transparent, rgba(143,20,10,0.95) 18%, rgba(143,20,10,0.95) 82%, transparent)'
                : 'linear-gradient(90deg, transparent, rgba(20,20,14,0.92) 18%, rgba(20,20,14,0.92) 82%, transparent)',
              borderTop: `2px solid ${isAsaf ? '#ff8f7f' : 'var(--gold-bright)'}`,
              borderBottom: `2px solid ${isAsaf ? '#ff8f7f' : 'var(--gold-bright)'}`,
            }}
          />
          <motion.div
            initial={{ scale: 0.3, rotate: -6, opacity: 0 }}
            animate={{ scale: [0.3, 1.15, 1], rotate: 0, opacity: 1 }}
            transition={{ duration: 0.45, times: [0, 0.7, 1], ease: 'easeOut' }}
            style={{ textAlign: 'center', position: 'relative' }}
          >
            <div
              style={{
                fontSize: 74,
                fontWeight: 900,
                color: isAsaf ? '#ff8f7f' : 'var(--gold-bright)',
                textShadow: '0 4px 22px rgba(0,0,0,0.8)',
                letterSpacing: 3,
                lineHeight: 1,
              }}
            >
              {isAsaf ? 'אסף!' : 'יניב!'}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ fontSize: 21, marginTop: 8, color: 'var(--cream)', fontWeight: 500 }}
            >
              {name}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// שורת שחקן בטבלת הניקוד
function ScoreRow({ r, name, isWinner, isAsafCaller, index }: any) {
  const delta = useCountUp(r.roundScore, 800, 500 + index * 120);
  const total = useCountUp(r.totalScore, 1000, 700 + index * 120);
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.12, type: 'spring', stiffness: 300, damping: 26 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: isWinner ? 'rgba(202,160,74,0.2)' : 'rgba(0,0,0,0.32)',
        border: `1.5px solid ${isWinner ? 'var(--gold-bright)' : 'var(--gold-dim)'}`,
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>
        {isWinner ? '🏆' : isAsafCaller ? '💥' : ''}
      </span>
      <span style={{ fontWeight: 700, flex: 1, fontSize: 16 }}>
        {name}
        {r.eliminated && <span style={{ color: '#ff8f7f', fontSize: 12, marginInlineStart: 6 }}>הודח</span>}
      </span>
      <span style={{ fontSize: 14, minWidth: 46, textAlign: 'center', color: r.roundScore > 0 ? '#ff9a8a' : 'var(--gold-bright)', fontWeight: 700, direction: 'ltr', display: 'inline-block' }}>
        {r.roundScore > 0 ? `+${delta}` : '0'}
      </span>
      <span style={{ fontSize: 18, minWidth: 44, textAlign: 'center', fontWeight: 900, color: 'var(--gold-bright)' }}>
        {total}
      </span>
    </motion.div>
  );
}

// ---- טבלת ניקוד סוף-סיבוב (אחרי שלב החשיפה בשולחן) ----
export function ScorePanel() {
  const room = useNet((s) => s.room)!;
  const sessionId = useNet((s) => s.sessionId);
  const continueGame = useNet((s) => s.continueGame);
  useNet((s) => s.stateVersion);

  const state = room.state as any;
  const rr = state.roundResult;
  const isHost = state.hostId === sessionId;

  const players = getPlayers(state);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || '';

  // מארח מקדם אוטומטית אחרי 8 שניות (אפשר גם ידנית)
  useEffect(() => {
    if (!isHost) return;
    const t = setTimeout(continueGame, 8000);
    return () => clearTimeout(t);
  }, [isHost, continueGame]);

  const results: any[] = [];
  rr.players?.forEach((p: any) => results.push(p));
  results.sort((a, b) => a.totalScore - b.totalScore);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(4,26,17,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, overflowY: 'auto' }}
    >
      <motion.h2
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="title-gold"
        style={{ fontSize: 27, marginTop: 10 }}
      >
        {rr.asaf ? '💥 אסף!' : '🏆 יניב!'}
      </motion.h2>
      <p style={{ margin: '6px 0 14px', fontSize: 14.5, opacity: 0.85, textAlign: 'center' }}>
        {rr.asaf
          ? `${nameOf(rr.callerId)} הכריז על ${rr.callerValue} — אבל ל${nameOf(rr.asafById)} היה פחות (+30 עונש)`
          : `${nameOf(rr.callerId)} הכריז יניב על ${rr.callerValue} וזכה בסיבוב`}
      </p>

      <div style={{ width: '100%', maxWidth: 340, display: 'flex', gap: 10, fontSize: 11.5, opacity: 0.6, padding: '0 14px 4px', justifyContent: 'flex-end' }}>
        <span style={{ minWidth: 46, textAlign: 'center' }}>סיבוב</span>
        <span style={{ minWidth: 44, textAlign: 'center' }}>סה"כ</span>
      </div>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map((r: any, i: number) => (
          <ScoreRow
            key={r.playerId}
            r={r}
            index={i}
            name={nameOf(r.playerId)}
            isWinner={r.playerId === rr.winnerId}
            isAsafCaller={rr.asaf && r.playerId === rr.callerId}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />
      {isHost ? (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="btn-gold pulse"
          style={{ maxWidth: 340, width: '100%' }}
          onClick={continueGame}
        >
          סיבוב הבא ←
        </motion.button>
      ) : (
        <div style={{ opacity: 0.8, padding: 12, fontSize: 14 }}>הסיבוב הבא מתחיל עוד רגע…</div>
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
    buzz([80, 50, 80, 50, 160]);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 45, background: 'rgba(4,26,17,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 }}
        style={{ fontSize: 74 }}
      >
        🏆
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="title-gold"
        style={{ fontSize: 34, textAlign: 'center' }}
      >
        {winner?.name} ניצח!
      </motion.h1>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {players.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 + i * 0.12 }}
            style={{ display: 'flex', justifyContent: 'space-between', background: i === 0 ? 'rgba(202,160,74,0.2)' : 'rgba(0,0,0,0.3)', border: `1px solid ${i === 0 ? 'var(--gold-bright)' : 'var(--gold-dim)'}`, borderRadius: 10, padding: '11px 14px' }}
          >
            <span style={{ fontWeight: i === 0 ? 700 : 400 }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.name}
            </span>
            <span style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{p.score} נק'</span>
          </motion.div>
        ))}
      </div>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="btn-gold"
        style={{ maxWidth: 320, width: '100%', marginTop: 12 }}
        onClick={leave}
      >
        חזרה לתפריט
      </motion.button>
    </motion.div>
  );
}
