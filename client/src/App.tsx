// ניתוב מסכים לפי מצב החיבור ושלב המשחק
import { useEffect } from 'react';
import { useNet } from './net/colyseus';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Table } from './screens/Table';
import { unlockAudio } from './game/sfx';

export function App() {
  // שחרור אודיו במגע הראשון — בלי זה דפדפנים חוסמים קול לגמרי
  useEffect(() => {
    const h = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
  }, []);

  const room = useNet((s) => s.room);
  const connected = useNet((s) => s.connected);
  useNet((s) => s.stateVersion); // רה-רנדר בכל שינוי state

  if (!room || !connected) return <Home />;

  const phase = (room.state as any).phase as string;
  if (phase === 'lobby') return <Lobby />;
  return <Table />;
}
