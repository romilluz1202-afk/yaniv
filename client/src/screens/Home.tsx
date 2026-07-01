// מסך פתיחה — יצירת חדר או הצטרפות בקוד + כינוי
import { useState, useEffect } from 'react';
import { useNet } from '../net/colyseus';
import { heError } from '../game/messages';
import { Card } from '../components/Card';

const NAME_KEY = 'yaniv_name';

export function Home() {
  const createRoom = useNet((s) => s.createRoom);
  const joinRoom = useNet((s) => s.joinRoom);
  const error = useNet((s) => s.error);
  const connecting = useNet((s) => s.connecting);
  const clearError = useNet((s) => s.clearError);

  const [name, setName] = useState(localStorage.getItem(NAME_KEY) || '');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  // קוד מתוך ה-URL (?room=ABCD) → מעבר ישיר למסך הצטרפות
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('room');
    if (p) {
      setCode(p.toUpperCase());
      setMode('join');
    }
  }, []);

  const saveName = (n: string) => {
    setName(n);
    localStorage.setItem(NAME_KEY, n);
  };

  const nameOk = name.trim().length >= 1;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 22 }}>
      {/* לוגו */}
      <div style={{ display: 'flex', gap: -18, marginBottom: 4 }}>
        <div style={{ transform: 'rotate(-12deg)' }}><Card card={{ id: 'H7', suit: 'H', rank: 7, joker: false }} w={54} /></div>
        <div style={{ transform: 'rotate(6deg)', marginInlineStart: -14 }}><Card card={{ id: 'S1', suit: 'S', rank: 1, joker: false }} w={54} /></div>
      </div>
      <h1 className="title-gold" style={{ fontSize: 54, margin: 0 }}>יניב</h1>
      <p style={{ margin: '-10px 0 8px', opacity: 0.8, fontSize: 15 }}>משחק הקלפים · שחקו יחד</p>

      <input
        className="field"
        placeholder="השם שלך"
        value={name}
        maxLength={16}
        onChange={(e) => saveName(e.target.value)}
        style={{ maxWidth: 300 }}
      />

      {mode === 'menu' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
          <button className="btn-gold" disabled={!nameOk || connecting} onClick={() => createRoom(name.trim())}>
            {connecting ? 'מתחבר…' : 'צור חדר חדש'}
          </button>
          <button className="btn-ghost" disabled={!nameOk} onClick={() => { clearError(); setMode('join'); }}>
            הצטרף לחדר קיים
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
          <input
            className="field"
            placeholder="קוד חדר (4 תווים)"
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ letterSpacing: 8, fontWeight: 700, fontSize: 26 }}
          />
          <button
            className="btn-gold"
            disabled={!nameOk || code.length < 4 || connecting}
            onClick={() => joinRoom(code, name.trim())}
          >
            {connecting ? 'מתחבר…' : 'הצטרף'}
          </button>
          <button className="btn-ghost" onClick={() => { clearError(); setMode('menu'); }}>חזרה</button>
        </div>
      )}

      {error && (
        <div style={{ color: '#ffd9d0', background: 'rgba(150,30,20,0.4)', padding: '10px 16px', borderRadius: 10, fontSize: 14, maxWidth: 300, textAlign: 'center' }}>
          {heError(error)}
        </div>
      )}
    </div>
  );
}
