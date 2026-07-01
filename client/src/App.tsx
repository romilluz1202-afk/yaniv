// ניתוב מסכים לפי מצב החיבור ושלב המשחק
import { useNet } from './net/colyseus';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Table } from './screens/Table';

export function App() {
  const room = useNet((s) => s.room);
  const connected = useNet((s) => s.connected);
  useNet((s) => s.stateVersion); // רה-רנדר בכל שינוי state

  if (!room || !connected) return <Home />;

  const phase = (room.state as any).phase as string;
  if (phase === 'lobby') return <Lobby />;
  return <Table />;
}
