// שרת ראשי — Colyseus (WebSocket authoritative) + Express (מגיש את הלקוח הבנוי)
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';
import colyseusMonitor from '@colyseus/monitor';

const { Server } = colyseus;
const { WebSocketTransport } = wsTransport;
const { monitor } = colyseusMonitor;
import { YanivRoom } from './rooms/YanivRoom';
import { roomRegistry } from './rooms/registry';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(cors());
app.use(express.json());

// המרת קוד-חדר ל-roomId עבור הצטרפות
app.get('/api/room/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const roomId = roomRegistry.get(code);
  if (!roomId) return res.status(404).json({ error: 'room-not-found' });
  res.json({ roomId });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, rooms: roomRegistry.size }));

// לוח ניטור של Colyseus (לפיתוח)
app.use('/colyseus', monitor());

// הגשת הלקוח הבנוי (production) — client/dist
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(200).send('Yaniv server is running. Build the client to serve the app.');
  });
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: createServer(app) }),
});

gameServer.define('yaniv', YanivRoom);

gameServer.listen(PORT);
console.log(`🎴 Yaniv server listening on http://localhost:${PORT}`);
