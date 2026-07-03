// שכבת "מעוף" — מנפישה קלפים שעפים בין אזורים במסך (קופה→שחקן, יד→ערימה וכו').
// אזורים נרשמים ב-ref, וכל אירוע רשת מתורגם לטיסה ויזואלית מעל השולחן.
import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Card as TCard } from '@shared/types';
import { Card } from '../components/Card';

interface Rect { x: number; y: number; w: number; h: number }

export interface FlightSpec {
  card?: TCard; // אם חסר — הקלף עף הפוך (גב)
  faceDown?: boolean;
  from: string; // מזהה אזור מקור
  to: string; // מזהה אזור יעד
  w?: number;
  dur?: number; // שניות
  delay?: number; // מילישניות
  spin?: number; // סיבוב התחלתי במעלות
  arc?: number; // קימור המסלול (פיקסלים כלפי מעלה)
}

interface Flight extends FlightSpec { key: number; fromR: Rect; toR: Rect }

interface FlyApi {
  fly: (spec: FlightSpec) => void;
  register: (id: string) => (el: HTMLElement | null) => void;
}

const Ctx = createContext<FlyApi>({ fly: () => {}, register: () => () => {} });
export function useFly() {
  return useContext(Ctx);
}

let seq = 1;

export function FlyProvider({ children }: { children: ReactNode }) {
  const zones = useRef(new Map<string, HTMLElement>());
  const [flights, setFlights] = useState<Flight[]>([]);

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) zones.current.set(id, el);
    },
    []
  );

  const fly = useCallback((spec: FlightSpec) => {
    const fromEl = zones.current.get(spec.from);
    const toEl = zones.current.get(spec.to);
    if (!fromEl || !toEl) return;
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const f: Flight = {
      ...spec,
      key: seq++,
      fromR: { x: fr.left, y: fr.top, w: fr.width, h: fr.height },
      toR: { x: tr.left, y: tr.top, w: tr.width, h: tr.height },
    };
    setFlights((fs) => [...fs, f]);
    const total = (spec.delay || 0) + (spec.dur || 0.5) * 1000 + 180;
    setTimeout(() => setFlights((fs) => fs.filter((x) => x.key !== f.key)), total);
  }, []);

  return (
    <Ctx.Provider value={{ fly, register }}>
      {children}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 70 }}>
        {flights.map((f) => {
          const w = f.w || 56;
          const h = w * 1.4;
          const from = { x: f.fromR.x + f.fromR.w / 2 - w / 2, y: f.fromR.y + f.fromR.h / 2 - h / 2 };
          const to = { x: f.toR.x + f.toR.w / 2 - w / 2, y: f.toR.y + f.toR.h / 2 - h / 2 };
          const midY = Math.min(from.y, to.y) - (f.arc ?? 30);
          return (
            <motion.div
              key={f.key}
              initial={{ x: from.x, y: from.y, rotate: f.spin ?? -6, scale: 1.04, opacity: 0.95 }}
              animate={{
                x: [from.x, (from.x + to.x) / 2, to.x],
                y: [from.y, midY, to.y],
                rotate: 0,
                scale: 1,
                opacity: 1,
              }}
              transition={{
                delay: (f.delay || 0) / 1000,
                duration: f.dur || 0.5,
                ease: [0.25, 0.9, 0.35, 1],
                times: [0, 0.45, 1],
              }}
              style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform' }}
            >
              <Card card={f.card} faceDown={f.faceDown || !f.card} w={w} />
            </motion.div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
