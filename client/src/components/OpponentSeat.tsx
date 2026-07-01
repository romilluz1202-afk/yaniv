// מושב יריב — אווטאר, שם, ניקוד, גבי קלפים לפי מספר הקלפים ביד
import { motion } from 'framer-motion';
import type { PlayerView } from '../game/state';
import { Card } from './Card';

export function OpponentSeat({ p }: { p: PlayerView }) {
  const backs = Math.min(p.handCount, 7);
  return (
    <motion.div
      layout
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        opacity: p.out ? 0.4 : 1,
        minWidth: 72,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: p.isTurn ? 'var(--gold)' : 'var(--felt-dark)',
          border: `2px solid ${p.isTurn ? 'var(--gold-bright)' : 'var(--gold-dim)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: p.isTurn ? '#2a2006' : 'var(--gold-bright)',
          fontWeight: 700,
          fontSize: 16,
          boxShadow: p.isTurn ? '0 0 12px rgba(230,201,131,0.6)' : 'none',
          position: 'relative',
        }}
      >
        {p.name.charAt(0)}
        {!p.connected && (
          <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, fontSize: 10 }}>⚡</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.name}
      </div>
      <div style={{ fontSize: 11, color: 'var(--gold-bright)' }}>{p.score} נק'</div>
      <div style={{ display: 'flex', height: 26 }}>
        {p.out ? (
          <span style={{ fontSize: 11, opacity: 0.7 }}>הודח</span>
        ) : (
          Array.from({ length: backs }).map((_, i) => (
            <div key={i} style={{ marginInlineStart: i === 0 ? 0 : -13 }}>
              <Card faceDown w={18} />
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
