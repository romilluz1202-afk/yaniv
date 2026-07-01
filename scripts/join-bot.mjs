// בוט שמצטרף לחדר לפי קוד ומשחק את תוריו — לצורך בדיקה ויזואלית של השולחן
import { Client } from '../client/node_modules/colyseus.js/build/esm/index.mjs';
const ENDPOINT = 'ws://localhost:2567';
const code = process.argv[2];
const name = process.argv[3] || 'רועי';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const val = (c) => (c.joker ? 0 : c.rank >= 11 ? 10 : c.rank);

const res = await fetch(`http://localhost:2567/api/room/${code}`);
const { roomId } = await res.json();
const client = new Client(ENDPOINT);
const room = await client.joinById(roomId, { name });
let hand = [], value = 99;
room.onMessage('hand', (m) => { hand = m.cards; value = m.value; });
room.onMessage('anim', () => {});
room.onMessage('error', () => {});
console.log(`${name} joined ${code}`);

setInterval(async () => {
  if (room.state.phase !== 'playing') return;
  if (room.state.currentTurnId !== room.sessionId) return;
  await sleep(700);
  if (value <= 7) { room.send('yaniv'); return; }
  const worst = hand.reduce((a, b) => (val(b) > val(a) ? b : a), hand[0]);
  if (worst) room.send('discard', { cardIds: [worst.id], drawSource: 'deck' });
}, 500);

// המשך אוטומטי אם הבוט הוא המארח (לא צפוי כאן, אך ליתר ביטחון)
setInterval(() => {
  if (room.state.phase === 'roundEnd' && room.state.hostId === room.sessionId) room.send('continue');
}, 1500);
