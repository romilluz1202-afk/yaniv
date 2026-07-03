// מושב יריב — אווטאר עם טבעת תור נודדת, ניקוד, גבי קלפים,
// ובסוף סיבוב: חשיפת היד במקום (flip מדורג) + תג ערך ודלתא
import { motion, AnimatePresence } from 'framer-motion';
import type { Card as TCard } from '@shared/types';
import type { PlayerView } from '../game/state';
import { Card } from './Card';

export interface SeatReveal {
  cards: TCard[];
  value: number;
  delta: number; // כמה נוסף לניקוד
  badge: 'yaniv' | 'asaf' | 'winner' | null;
  out: boolean;
}

export function OpponentSeat({ p, reveal }: { p: PlayerView; reveal?: SeatReveal | null }) {
  const backs = Math.min(p.handCount, 7);
  return (
    <motion.div
      layout
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        opacity: p.out && !reveal ? 0.4 : 1,
        minWidth: 76,
        position: 'relative',
      }}
    >
      {/* אווטאר + טבעת תור נודדת בין שחקנים */}
      <div style={{ position: 'relative', width: 46, height: 46 }}>
        {p.isTurn && (
          <motion.div
            layoutId="turn-ring"
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              position: 'absolute',
              inset: -5,
              borderRadius: '50%',
              border: '2.5px solid var(--gold-bright)',
              boxShadow: '0 0 14px rgba(230,201,131,0.65)',
            }}
          />
        )}
        {p.isTurn && (
          <motion.div
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: -5,
              borderRadius: '50%',
              border: '2px solid var(--gold-bright)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 2,
            borderRadius: '50%',
            background: p.isTurn ? 'var(--gold)' : 'var(--felt-dark)',
            border: `2px solid ${p.isTurn ? 'var(--gold-bright)' : 'var(--gold-dim)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: p.isTurn ? '#2a2006' : 'var(--gold-bright)',
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {p.name.charAt(0)}
          {!p.connected && (
            <span style={{ position: 'absolute', bottom: -3, insetInlineEnd: -3, fontSize: 11 }}>⚡</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 500, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.name}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#2a2006',
          background: 'var(--gold)',
          borderRadius: 8,
          padding: '1px 8px',
        }}
      >
        {p.score} נק'
      </div>

      {/* יד: גבים בזמן משחק / חשיפה בסוף סיבוב */}
      <div style={{ minHeight: 42, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <AnimatePresence mode="popLayout">
          {reveal ? (
            <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ display: 'flex' }}>
                {reveal.cards.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ rotateY: 90, opacity: 0, y: -6 }}
                    animate={{ rotateY: 0, opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.09, type: 'spring', stiffness: 300, damping: 22 }}
                    style={{ marginInlineStart: i === 0 ? 0 : -9, transform: `rotate(${(i - (reveal.cards.length - 1) / 2) * 4}deg)` }}
                  >
                    <Card card={c} w={28} />
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 18 }}
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '2px 9px',
                  background:
                    reveal.badge === 'asaf' ? '#8f1f14' : reveal.badge ? 'var(--gold-bright)' : 'rgba(0,0,0,0.4)',
                  color: reveal.badge === 'asaf' ? '#ffe2da' : reveal.badge ? '#2a2006' : 'var(--text-light)',
                }}
              >
                {reveal.value} נק'
                {reveal.badge === 'yaniv' && ' · יניב!'}
                {reveal.badge === 'asaf' && ' · אסף!'}
                {reveal.badge === 'winner' && ' · 🏆'}
                {reveal.delta > 0 && ` · ‎+${reveal.delta}`}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="backs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', height: 30, paddingTop: 2 }}>
              {p.out ? (
                <span style={{ fontSize: 11, opacity: 0.7 }}>הודח</span>
              ) : (
                Array.from({ length: backs }).map((_, i) => (
                  <motion.div key={i} layout style={{ marginInlineStart: i === 0 ? 0 : -14, transform: `rotate(${(i - (backs - 1) / 2) * 5}deg)` }}>
                    <Card faceDown w={20} />
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
