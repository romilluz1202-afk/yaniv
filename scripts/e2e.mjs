// בדיקת e2e: 2 שחקנים יוצרים חדר, מתחילים, משחקים תורים עד יניב, ובודקים תוצאה.
// מריצים מול שרת חי על localhost:2567. משתמש ב-colyseus.js מתיקיית הלקוח.
import { Client } from '../client/node_modules/colyseus.js/build/esm/index.mjs';

const ENDPOINT = 'ws://localhost:2567';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function value(card) {
  if (card.joker) return 0;
  if (card.rank >= 11) return 10;
  return card.rank;
}
function handValue(cards) {
  return cards.reduce((s, c) => s + value(c), 0);
}

function attach(room, store) {
  room.onMessage('hand', (m) => {
    store.hand = m.cards;
    store.value = m.value;
    store.canYaniv = m.canYaniv;
  });
  room.onMessage('error', (m) => console.log(`  [err ${store.name}]`, m.reason));
  room.onMessage('anim', () => {});
}

async function main() {
  const c1 = new Client(ENDPOINT);
  const c2 = new Client(ENDPOINT);

  const s1 = { name: 'A' };
  const s2 = { name: 'B' };

  const room1 = await c1.create('yaniv', { name: 'A' });
  attach(room1, s1);
  await sleep(200);
  const code = room1.state.roomCode;
  console.log('room code:', code, 'roomId:', room1.roomId);

  const room2 = await c2.joinById(room1.roomId, { name: 'B' });
  attach(room2, s2);
  await sleep(300);

  console.log('players in lobby:', room1.state.players.size);
  if (room1.state.players.size !== 2) throw new Error('FAIL: expected 2 players');

  // התחלה
  room1.send('start');
  await sleep(400);
  console.log('phase after start:', room1.state.phase);
  if (room1.state.phase !== 'playing') throw new Error('FAIL: game did not start');
  console.log('A hand size:', s1.hand?.length, '| B hand size:', s2.hand?.length);
  if (s1.hand?.length !== 5 || s2.hand?.length !== 5) throw new Error('FAIL: wrong deal');

  // לולאת תורים: מי שתורו — אם יכול יניב מכריז, אחרת זורק קלף ומושך מהקופה
  const rooms = { [room1.sessionId]: { room: room1, s: s1 }, [room2.sessionId]: { room: room2, s: s2 } };
  let guard = 0;
  let called = false;
  while (guard++ < 300) {
    const turnId = room1.state.currentTurnId;
    if (room1.state.phase !== 'playing') break;
    const me = rooms[turnId];
    if (!me) { await sleep(30); continue; }
    if (me.s.value <= 7) {
      console.log(`  ${me.s.name} calls YANIV (value ${me.s.value})`);
      me.room.send('yaniv');
      called = true;
      await sleep(300);
      break;
    }
    // זרוק קלף בעל הערך הגבוה, משוך מהקופה
    const worst = me.s.hand.reduce((a, b) => (value(b) > value(a) ? b : a), me.s.hand[0]);
    me.room.send('discard', { cardIds: [worst.id], drawSource: 'deck' });
    await sleep(60);
  }

  await sleep(300);
  console.log('phase after play:', room1.state.phase);
  console.log('called yaniv:', called);
  if (room1.state.phase !== 'roundEnd' && room1.state.phase !== 'gameOver')
    throw new Error('FAIL: expected roundEnd/gameOver, got ' + room1.state.phase);

  const rr = room1.state.roundResult;
  console.log('round result → caller:', rr.callerId === room1.sessionId ? 'A' : 'B', '| asaf:', rr.asaf, '| winner:', rr.winnerId === room1.sessionId ? 'A' : 'B');
  let sum = 0;
  rr.players.forEach((p) => {
    const nm = p.playerId === room1.sessionId ? 'A' : 'B';
    console.log(`   ${nm}: hand=${p.handValue} round=+${p.roundScore} total=${p.totalScore} out=${p.eliminated}`);
    sum += p.hand.length;
  });
  if (sum === 0) throw new Error('FAIL: hands not revealed');

  // בדיקת סיבוב הבא
  if (room1.state.phase === 'roundEnd') {
    room1.send('continue');
    await sleep(400);
    console.log('phase after continue:', room1.state.phase);
    if (room1.state.phase !== 'playing') throw new Error('FAIL: next round did not start');
  }

  console.log('\n✅ E2E PASSED');
  room1.leave();
  room2.leave();
  await sleep(200);
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
