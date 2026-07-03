// רכיב קלף — רינדור SVG (viewBox קבוע 100x140) => חד ונקי בכל גודל, בלי שבירות layout.
// אינדקסים בפינות, סידור pip אמיתי, קלפי תמונה ממוסגרים, גב אדום עם מסגרת זהב.
import { motion } from 'framer-motion';
import { useId } from 'react';
import type { Card as TCard, Suit } from '@shared/types';

const GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// מיקומי pip לכל ערך (באחוזי רוחב/גובה); pip בחצי התחתון מסובב 180°
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 20], [50, 80]],
  3: [[50, 20], [50, 50], [50, 80]],
  4: [[32, 20], [68, 20], [32, 80], [68, 80]],
  5: [[32, 20], [68, 20], [50, 50], [32, 80], [68, 80]],
  6: [[32, 20], [68, 20], [32, 50], [68, 50], [32, 80], [68, 80]],
  7: [[32, 20], [68, 20], [50, 35], [32, 50], [68, 50], [32, 80], [68, 80]],
  8: [[32, 20], [68, 20], [50, 35], [32, 50], [68, 50], [50, 65], [32, 80], [68, 80]],
  9: [[32, 18], [68, 18], [32, 39], [68, 39], [50, 50], [32, 61], [68, 61], [32, 82], [68, 82]],
  10: [[32, 17], [68, 17], [50, 27], [32, 40], [68, 40], [32, 60], [68, 60], [50, 73], [32, 83], [68, 83]],
};

interface Props {
  card?: TCard;
  faceDown?: boolean;
  w?: number; // רוחב בפיקסלים
  selected?: boolean;
  pickable?: boolean;
  dimmed?: boolean;
  blink?: boolean; // הבהוב הדבקה
  onClick?: () => void;
  style?: React.CSSProperties;
}

function CardBack({ w, pid }: { w: number; pid: string }) {
  const h = Math.round(w * 1.4);
  return (
    <svg viewBox="0 0 100 140" width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <pattern id={pid} width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#6f1c27" />
          <rect width="5" height="10" fill="#5c1620" />
        </pattern>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill={`url(#${pid})`} stroke="#caa04a" strokeWidth="3" />
      <rect x="8" y="8" width="84" height="124" rx="6" fill="none" stroke="#caa04a" strokeWidth="1.2" opacity="0.55" />
      <circle cx="50" cy="70" r="15" fill="none" stroke="#caa04a" strokeWidth="1.2" opacity="0.5" />
      <text x="50" y="76" textAnchor="middle" fontSize="16" fill="#caa04a" opacity="0.75">♠</text>
    </svg>
  );
}

function CardFace({ card, w, border }: { card: TCard; w: number; border: string }) {
  const h = Math.round(w * 1.4);
  const red = card.suit === 'H' || card.suit === 'D';
  const color = card.joker ? '#8a1c2c' : red ? '#b3132b' : '#1c1c1e';
  const glyph = card.joker ? '★' : GLYPH[card.suit as Suit];
  const lab = card.joker ? '★' : LABEL[card.rank] || String(card.rank);
  const pips = !card.joker ? PIPS[card.rank] : undefined;
  const isFace = card.rank >= 11;
  const isAce = card.rank === 1;

  return (
    <svg viewBox="0 0 100 140" width={w} height={h} style={{ display: 'block' }}>
      <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#fdfcf7" stroke={border} strokeWidth="2.5" />
      <rect x="5" y="5" width="90" height="130" rx="7" fill="none" stroke="#eae4d2" strokeWidth="1" />

      {/* אינדקסים בפינות (עליון + תחתון מסובב) */}
      <g fill={color}>
        <text x="14" y="22" fontSize="20" fontWeight="700" textAnchor="middle" fontFamily="Heebo, sans-serif">{lab}</text>
        <text x="14" y="38" fontSize="15" textAnchor="middle">{glyph}</text>
        <g transform="rotate(180 50 70)">
          <text x="14" y="22" fontSize="20" fontWeight="700" textAnchor="middle" fontFamily="Heebo, sans-serif">{lab}</text>
          <text x="14" y="38" fontSize="15" textAnchor="middle">{glyph}</text>
        </g>
      </g>

      {/* מרכז */}
      <g fill={color}>
        {pips && !isAce &&
          pips.map(([px, py], i) => {
            const cy = py * 1.4;
            return (
              <text
                key={i}
                x={px}
                y={cy + 7.5}
                fontSize="21"
                textAnchor="middle"
                transform={py > 50 ? `rotate(180 ${px} ${cy})` : undefined}
              >
                {glyph}
              </text>
            );
          })}
        {isAce && (
          <text x="50" y="87" fontSize="52" textAnchor="middle">{glyph}</text>
        )}
        {isFace && (
          <>
            <rect x="24" y="30" width="52" height="80" rx="6" fill="none" stroke={color} strokeWidth="1.4" opacity="0.45" />
            <rect x="28" y="34" width="44" height="72" rx="4" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" />
            <text x="50" y="79" fontSize="38" fontWeight="700" textAnchor="middle" fontFamily="Heebo, sans-serif">{lab}</text>
            <text x="50" y="101" fontSize="17" textAnchor="middle">{glyph}</text>
          </>
        )}
        {card.joker && (
          <>
            <text x="50" y="80" fontSize="46" textAnchor="middle">★</text>
            <text x="50" y="103" fontSize="10" letterSpacing="3" textAnchor="middle" fontFamily="Heebo, sans-serif" fontWeight="700">JOKER</text>
          </>
        )}
      </g>
    </svg>
  );
}

export function Card({ card, faceDown, w = 58, selected, pickable, dimmed, blink, onClick, style }: Props) {
  const pid = useId().replace(/:/g, '');
  const isBack = faceDown || !card;
  const border = selected || pickable ? '#e6c983' : '#d8d2c0';

  const animate: any = { y: selected ? -16 : 0 };
  const transition: any = { y: { type: 'spring', stiffness: 520, damping: 30 } };
  if (blink) {
    animate.scale = [1, 1.07, 1];
    animate.boxShadow = [
      '0 0 0 0 rgba(230,201,131,0)',
      '0 0 0 7px rgba(230,201,131,0.45)',
      '0 0 0 0 rgba(230,201,131,0)',
    ];
    transition.scale = { repeat: Infinity, duration: 1 };
    transition.boxShadow = { repeat: Infinity, duration: 1 };
  }

  return (
    <motion.div
      layout
      onClick={onClick}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      animate={animate}
      transition={transition}
      style={{
        width: w,
        flex: '0 0 auto',
        position: 'relative',
        borderRadius: w * 0.1,
        boxShadow: selected
          ? '0 0 0 2px #caa04a, 0 8px 18px rgba(0,0,0,0.45)'
          : pickable
          ? '0 0 0 2px #e6c983, 0 4px 12px rgba(0,0,0,0.4)'
          : '0 2px 6px rgba(0,0,0,0.4)',
        opacity: dimmed ? 0.55 : 1,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {isBack ? <CardBack w={w} pid={pid} /> : <CardFace card={card!} w={w} border={border} />}
    </motion.div>
  );
}
