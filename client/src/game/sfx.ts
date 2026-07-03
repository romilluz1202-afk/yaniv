// אפקטים קוליים — WebAudio לצלילים + Web Speech API לצעקות "יניב!"/"אסף!"
// חשוב: דפדפנים חוסמים אודיו עד מחוות משתמש ראשונה — unlockAudio() נקרא מ-App
let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

// נקרא במגע הראשון של המשתמש — משחרר את ה-AudioContext ומחמם את מנוע הדיבור
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const a = ac();
    if (a.state === 'suspended') a.resume();
    // צליל דמה שקט כדי לקבע את השחרור ב-iOS
    const o = a.createOscillator();
    const g = a.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.02);
  } catch { /* noop */ }
  try {
    window.speechSynthesis?.getVoices();
  } catch { /* noop */ }
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
}
export function isMuted() {
  return muted;
}

// צעקה קולית בעברית (יניב! / אסף!)
export function speak(text: string) {
  if (muted) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    u.rate = 1.05;
    u.pitch = 1.2;
    u.volume = 1;
    const heVoice = synth.getVoices().find((v) => v.lang?.startsWith('he'));
    if (heVoice) u.voice = heVoice;
    synth.speak(u);
  } catch { /* noop */ }
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
  } catch { /* noop */ }
}

// רעש קצר (מברשת קלף) — לזריקות והחלקות
function swish(dur = 0.09, gain = 0.05, delay = 0) {
  if (muted) return;
  try {
    const a = ac();
    const size = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, size, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2600;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(a.destination);
    src.start(a.currentTime + delay);
  } catch { /* noop */ }
}

export const sfx = {
  flip: () => { swish(0.06, 0.04); },
  deal: () => { swish(0.08, 0.05); tone(300, 0.04, 'triangle', 0.03); },
  draw: () => { swish(0.07, 0.04); tone(520, 0.06, 'sine', 0.04); },
  slap: () => { tone(180, 0.09, 'square', 0.09); swish(0.05, 0.07, 0.02); },
  yourTurn: () => { tone(660, 0.09, 'sine', 0.06); tone(880, 0.12, 'sine', 0.06, 0.1); },
  yaniv: () => {
    speak('יניב!');
    tone(523, 0.12, 'triangle', 0.09, 0);
    tone(659, 0.12, 'triangle', 0.09, 0.11);
    tone(784, 0.14, 'triangle', 0.09, 0.22);
    tone(1046, 0.32, 'triangle', 0.1, 0.34);
  },
  asaf: () => {
    speak('אסף!');
    tone(220, 0.16, 'sawtooth', 0.08, 0);
    tone(185, 0.16, 'sawtooth', 0.08, 0.14);
    tone(147, 0.34, 'sawtooth', 0.09, 0.28);
  },
  win: () => {
    tone(523, 0.12, 'triangle', 0.09, 0);
    tone(659, 0.12, 'triangle', 0.09, 0.12);
    tone(784, 0.12, 'triangle', 0.09, 0.24);
    tone(1046, 0.4, 'triangle', 0.1, 0.36);
    tone(1318, 0.5, 'sine', 0.06, 0.5);
  },
};

// רטט קצר במובייל
export function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* noop */ }
}
