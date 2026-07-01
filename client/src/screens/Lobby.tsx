// לובי — קוד חדר לשיתוף, רשימת שחקנים, הגדרות בית (מארח), וכפתור התחלה
import { useState } from 'react';
import { useNet } from '../net/colyseus';
import { getPlayers } from '../game/state';
import { heError } from '../game/messages';

export function Lobby() {
  const room = useNet((s) => s.room)!;
  const sessionId = useNet((s) => s.sessionId);
  const start = useNet((s) => s.start);
  const setConfig = useNet((s) => s.setConfig);
  const leave = useNet((s) => s.leave);
  const error = useNet((s) => s.error);
  useNet((s) => s.stateVersion);

  const state = room.state as any;
  const players = getPlayers(state);
  const isHost = state.hostId === sessionId;
  const code: string = state.roomCode;
  const [copied, setCopied] = useState(false);

  const shareLink = `${window.location.origin}/?room=${code}`;

  const share = async () => {
    const text = `בוא נשחק יניב! הצטרף עם הקוד ${code}\n${shareLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'יניב', text });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 18, overflowY: 'auto' }}>
      <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: 13 }} onClick={leave}>
        ← יציאה
      </button>

      <h2 className="title-gold" style={{ fontSize: 26 }}>חדר משחק</h2>

      {/* קוד החדר */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>קוד החדר</div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: 12,
            color: 'var(--gold-bright)',
            background: 'rgba(0,0,0,0.25)',
            border: '2px solid var(--gold)',
            borderRadius: 14,
            padding: '8px 20px',
          }}
        >
          {code}
        </div>
      </div>

      <button className="btn-gold" style={{ maxWidth: 300, width: '100%' }} onClick={share}>
        {copied ? 'הקישור הועתק ✓' : 'שתף הזמנה'}
      </button>

      {/* שחקנים */}
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 8 }}>שחקנים ({players.length}/{state.maxPlayers})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--gold-dim)',
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--felt-dark)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-bright)', fontWeight: 700 }}>
                {p.name.charAt(0)}
              </div>
              <span style={{ fontWeight: 500, flex: 1 }}>{p.name}</span>
              {state.hostId === p.id && <span style={{ fontSize: 12, color: 'var(--gold-bright)' }}>מארח</span>}
              {p.id === sessionId && <span style={{ fontSize: 12, opacity: 0.6 }}>(אתה)</span>}
            </div>
          ))}
        </div>
      </div>

      {/* הגדרות בית — מארח בלבד */}
      {isHost && (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ConfigRow
            label="הכרזת יניב עד"
            value={state.yanivThreshold}
            options={[7, 5]}
            suffix=" נק'"
            onSelect={(v) => setConfig({ yanivThreshold: v })}
          />
          <ConfigRow
            label="מפסידים ב-"
            value={state.scoreLimit}
            options={[200, 100]}
            suffix=" נק'"
            onSelect={(v) => setConfig({ scoreLimit: v })}
          />
        </div>
      )}

      {error && <div style={{ color: '#ffd9d0', fontSize: 14 }}>{heError(error)}</div>}

      <div style={{ flex: 1 }} />

      {isHost ? (
        <button
          className={'btn-gold ' + (players.length >= 2 ? 'pulse' : '')}
          style={{ maxWidth: 320, width: '100%' }}
          disabled={players.length < 2}
          onClick={start}
        >
          {players.length < 2 ? 'ממתין לשחקן נוסף…' : 'התחל משחק'}
        </button>
      ) : (
        <div style={{ opacity: 0.8, fontSize: 15, padding: 14 }}>ממתין שהמארח יתחיל…</div>
      )}
    </div>
  );
}

function ConfigRow({
  label,
  value,
  options,
  suffix,
  onSelect,
}: {
  label: string;
  value: number;
  options: number[];
  suffix: string;
  onSelect: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 14, opacity: 0.85 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              border: '1.5px solid var(--gold-dim)',
              background: value === o ? 'var(--gold)' : 'rgba(0,0,0,0.2)',
              color: value === o ? '#2a2006' : 'var(--text-light)',
            }}
          >
            {o}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}
