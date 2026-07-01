// רכיב קלף קלאסי — אינדקסים בפינות, סידור pip אמיתי, גב אדום עם מסגרת זהב
import { motion } from 'framer-motion';
import type { Card as TCard, Suit } from '@shared/types';

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABEL: Record<number, string> = {
  1: 'A',
  11: 'J',
  12: 'Q',
  13: 'K',
};

function isRed(suit: Suit | null): boolean {
  return suit === 'H' || suit === 'D';
}

function label(card: TCard): string {
  if (card.joker) return '★';
  return RANK_LABEL[card.rank] || String(card.rank);
}

// מיקומי pip לכל ערך (אחוזים). pip בחצי התחתון מסובב 180°
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 16], [50, 84]],
  3: [[50, 16], [50, 50], [50, 84]],
  4: [[30, 16], [70, 16], [30, 84], [70, 84]],
  5: [[30, 16], [70, 16], [50, 50], [30, 84], [70, 84]],
  6: [[30, 16], [70, 16], [30, 50], [70, 50], [30, 84], [70, 84]],
  7: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [30, 84], [70, 84]],
  8: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [50, 67], [30, 84], [70, 84]],
  9: [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 84], [70, 84]],
  10: [[30, 15], [70, 15], [50, 28], [30, 40], [70, 40], [30, 60], [70, 60], [50, 72], [30, 85], [70, 85]],
};

interface Props {
  card?: TCard;
  faceDown?: boolean;
  w?: number; // רוחב בפיקסלים
  selected?: boolean;
  pickable?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({ card, faceDown, w = 58, selected, pickable, dimmed, onClick, style }: Props) {
  const h = Math.round(w * 1.4);
  const base: React.CSSProperties = {
    width: w,
    height: h,
    borderRadius: Math.max(5, w * 0.1),
    position: 'relative',
    flex: '0 0 auto',
    ...style,
  };

  if (faceDown || !card) {
    return (
      <motion.div
        layout
        onClick={onClick}
        style={{
          ...base,
          background: 'repeating-linear-gradient(45deg, #7a1f2b, #7a1f2b 6px, #641722 6px, #641722 12px)',
          border: '2px solid var(--gold)',
          boxShadow: '0 2px 6px var(--shadow)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: Math.max(3, w * 0.07),
            border: '1px solid var(--gold-dim)',
          }}
        />
      </motion.div>
    );
  }

  const red = isRed(card.suit);
  const color = card.joker ? '#7a1f2b' : red ? 'var(--card-red)' : 'var(--card-black)';
  const glyph = card.joker ? '★' : SUIT_GLYPH[card.suit as Suit];
  const lab = label(card);
  const isFace = card.rank >= 11 || card.rank === 1 || card.joker;
  const idxSize = Math.round(w * 0.26);
  const pipList = !card.joker && !isFace ? PIPS[card.rank] : undefined;

  return (
    <motion.div
      layout
      onClick={onClick}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={{ y: selected ? -14 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        ...base,
        background: 'var(--cream)',
        border: `2px solid ${selected || pickable ? 'var(--gold-bright)' : '#d8d2c0'}`,
        boxShadow: selected
          ? '0 0 0 2px var(--gold), 0 6px 14px var(--shadow)'
          : pickable
          ? '0 0 0 2px var(--gold-bright), 0 4px 10px var(--shadow)'
          : '0 2px 6px var(--shadow)',
        opacity: dimmed ? 0.55 : 1,
        color,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {/* אינדקס פינה עליונה */}
      <div style={{ position: 'absolute', top: 3, insetInlineStart: 4, lineHeight: 0.9, textAlign: 'center' }}>
        <div style={{ fontSize: idxSize, fontWeight: 700 }}>{lab}</div>
        <div style={{ fontSize: idxSize * 0.9 }}>{glyph}</div>
      </div>
      {/* אינדקס פינה תחתונה (מסובב) */}
      <div
        style={{
          position: 'absolute',
          bottom: 3,
          insetInlineEnd: 4,
          lineHeight: 0.9,
          textAlign: 'center',
          transform: 'rotate(180deg)',
        }}
      >
        <div style={{ fontSize: idxSize, fontWeight: 700 }}>{lab}</div>
        <div style={{ fontSize: idxSize * 0.9 }}>{glyph}</div>
      </div>

      {/* מרכז — pips למספרים, אות גדולה לתמונות/אס/ג'וקר */}
      {pipList ? (
        pipList.map(([x, y], i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) ${y > 50 ? 'rotate(180deg)' : ''}`,
              fontSize: w * 0.24,
            }}
          >
            {glyph}
          </span>
        ))
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: card.joker ? w * 0.5 : w * 0.62,
            fontWeight: 700,
          }}
        >
          {card.joker ? '★' : isFace && card.rank >= 11 ? lab : glyph}
        </div>
      )}
    </motion.div>
  );
}
