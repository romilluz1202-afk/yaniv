// בוט שמצטרף לחדר לפי קוד ומשחק את תוריו — לצורך בדיקה ויזואלית של השולחן.
// כל תור שלישי מושך מהערימה (כדי להדגים את אנימציית הלקיחה הפומבית).
import { Client } from '../client/node_modules/colyseus.js/build/esm/index.mjs';
const ENDPOINT = process.env.YANIV_URL || 'ws://localhost:2567';
const HTTP = ENDPOINT.replace(/^ws/, 'http');
const code = process.argv[2];
const name = process.argv[3] || 'רועי';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const val = (c) => (c.joker ? 0 : c.rank >= 11 ? 10 : c.rank);

const res = await fetch(`${HTTP}/api/room/${code}`);
const { roomId } = await res.json();
const client = new Client(ENDPOINT);
const room = await client.joinById(roomId, { name });
let hand = [], value = 99, slapId = null;
room.onMessage('hand', (m) => { hand = m.cards; value = m.value; slapId = m.slapCardId; });
room.onMessage('anim', () => {});
room.onMessage('error', (e) => console.log('bot err:', e.reason));
console.log(`${name} joined ${code}`);

let turn = 0;
setInterval(async () => {
  // הדבקה אם נפתח חלון
  if (slapId) {
    const id = slapId;
    slapId = null;
    room.send('slap', { cardId: id });
    console.log('bot slapped!');
    return;
  }
  if (room.state.phase !== 'playing') return;
  if (room.state.currentTurnId !== room.sessionId) return;
  await sleep(900);
  if (value <= room.state.yanivThreshold) { room.send('yaniv'); return; }
  turn++;
  const worst = hand.reduce((a, b) => (val(b) > val(a) ? b : a), hand[0]);
  if (!worst) return;
  // כל תור שלישי — משיכה פומבית מהערימה
  if (turn % 3 === 0) {
    const picks = [];
    room.state.discard.forEach((c) => { if (c.pickable) picks.push(c); });
    if (picks.length) {
      room.send('discard', { cardIds: [worst.id], drawSource: 'discard', pickupId: picks[0].id });
      return;
    }
  }
  room.send('discard', { cardIds: [worst.id], drawSource: 'deck' });
}, 600);
