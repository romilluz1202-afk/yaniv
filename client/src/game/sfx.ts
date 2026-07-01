// אפקטים קוליים סונתטיים (WebAudio) — ללא קבצי אודיו חיצוניים
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0) {
  if (muted) return;
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(a.destination);
    const t = a.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* audio not available */
  }
}

export const sfx = {
  flip: () => tone(420, 0.06, 'triangle', 0.05),
  deal: () => tone(300, 0.05, 'triangle', 0.04),
  draw: () => tone(520, 0.07, 'sine', 0.05),
  yaniv: () => {
    tone(523, 0.12, 'sine', 0.1, 0); // do
    tone(659, 0.12, 'sine', 0.1, 0.1); // mi
    tone(784, 0.22, 'sine', 0.1, 0.2); // sol
  },
  asaf: () => {
    tone(200, 0.18, 'sawtooth', 0.09, 0);
    tone(150, 0.28, 'sawtooth', 0.09, 0.12);
  },
  win: () => {
    tone(523, 0.12, 'sine', 0.1, 0);
    tone(659, 0.12, 'sine', 0.1, 0.12);
    tone(784, 0.12, 'sine', 0.1, 0.24);
    tone(1046, 0.3, 'sine', 0.1, 0.36);
  },
};
