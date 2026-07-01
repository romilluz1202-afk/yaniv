// חדר Colyseus — מגשר בין מנוע המשחק (EngineState) ל-schema המשותף.
// השרת הוא ה-authority: מחזיק את החפיסה, מאמת כל פעולה, ושולח ידיים פרטיות בלבד.
import { Room, Client } from '@colyseus/core';
import {
  GameState,
  PlayerState,
  CardState,
  RevealCard,
  PlayerResult,
} from './schema/GameState';
import { generateRoomCode, roomRegistry } from './registry';
import {
  EngineState,
  createGame,
  startRound,
  discardAndDraw,
  currentPlayer,
  activePlayers,
  canYaniv,
} from '../engine/round';
import { resolveRound } from '../engine/scoring';
import { handValue, pickableCards, canCallYaniv } from '../engine/combos';
import { cardValue } from '../engine/deck';
import {
  Card,
  DrawSource,
  DEFAULT_CONFIG,
  MSG,
  DiscardMessage,
  GameConfig,
} from '../../../shared/types';

const TURN_MS = 45000; // טיימר תור למניעת תקיעות

export class YanivRoom extends Room<GameState> {
  private engine!: EngineState;
  private lobbyOrder: { id: string; name: string }[] = [];
  private turnTimer?: ReturnType<typeof setTimeout>;

  onCreate(options: any) {
    this.maxClients = DEFAULT_CONFIG.maxPlayers;
    const state = new GameState();
    state.roomCode = generateRoomCode();
    state.yanivThreshold = DEFAULT_CONFIG.yanivThreshold;
    state.scoreLimit = DEFAULT_CONFIG.scoreLimit;
    state.maxPlayers = DEFAULT_CONFIG.maxPlayers;
    this.setState(state);
    roomRegistry.set(state.roomCode, this.roomId);

    this.onMessage('start', (client) => this.handleStart(client));
    this.onMessage('config', (client, msg: { config: Partial<GameConfig> }) =>
      this.handleConfig(client, msg)
    );
    this.onMessage('discard', (client, msg: DiscardMessage) => this.handleDiscard(client, msg));
    this.onMessage('yaniv', (client) => this.handleYaniv(client));
    this.onMessage('continue', (client) => this.handleContinue(client));
  }

  onAuth() {
    // הצטרפות מותרת רק בלובי (משחק שהתחיל נעול לחדשים; reconnection נפרד)
    if (this.state.phase !== 'lobby') {
      if (this.clients.length >= this.state.maxPlayers) return false;
    }
    return true;
  }

  onJoin(client: Client, options: any) {
    const name = (options?.name || 'שחקן').toString().slice(0, 16);
    const seat = this.state.players.size;
    const p = new PlayerState();
    p.id = client.sessionId;
    p.name = name;
    p.seat = seat;
    p.connected = true;
    this.state.players.set(client.sessionId, p);
    this.lobbyOrder.push({ id: client.sessionId, name });
    if (!this.state.hostId) this.state.hostId = client.sessionId;
  }

  async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;

    // בלובי — הסרה מיידית; במשחק — נותנים חלון reconnection
    if (this.state.phase === 'lobby') {
      this.removePlayer(client.sessionId);
      return;
    }
    try {
      await this.allowReconnection(client, 40);
      const rp = this.state.players.get(client.sessionId);
      if (rp) rp.connected = true;
      this.sendHand(client.sessionId);
    } catch {
      // לא חזר — מסמנים מנותק אך משאירים במשחק (הניקוד נשמר)
    }
  }

  onDispose() {
    if (this.state?.roomCode) roomRegistry.delete(this.state.roomCode);
    if (this.turnTimer) clearTimeout(this.turnTimer);
  }

  // ---------- handlers ----------

  private handleConfig(client: Client, msg: { config: Partial<GameConfig> }) {
    if (client.sessionId !== this.state.hostId) return;
    if (this.state.phase !== 'lobby') return;
    const c = msg.config || {};
    if (c.yanivThreshold === 5 || c.yanivThreshold === 7)
      this.state.yanivThreshold = c.yanivThreshold;
    if (c.scoreLimit === 100 || c.scoreLimit === 200) this.state.scoreLimit = c.scoreLimit;
  }

  private handleStart(client: Client) {
    if (client.sessionId !== this.state.hostId) return;
    if (this.state.phase !== 'lobby') return;
    if (this.state.players.size < 2) {
      client.send(MSG.ERROR, { reason: 'need-2-players' });
      return;
    }
    const config: GameConfig = {
      yanivThreshold: this.state.yanivThreshold,
      scoreLimit: this.state.scoreLimit,
      maxPlayers: this.state.maxPlayers,
    };
    this.engine = createGame(this.lobbyOrder, config);
    this.beginRound();
  }

  private beginRound(startPlayerId?: string) {
    this.state.hasResult = false;
    startRound(this.engine, startPlayerId);
    this.state.phase = 'playing';
    this.broadcast(MSG.ANIM, { type: 'deal' });
    this.syncPublic();
    this.sendAllHands();
    this.startTurnTimer();
  }

  private handleDiscard(client: Client, msg: DiscardMessage) {
    if (this.state.phase !== 'playing') return;
    try {
      const cur = currentPlayer(this.engine);
      const discardedCards = msg.cardIds
        .map((id) => cur.hand.find((c) => c.id === id))
        .filter(Boolean) as Card[];
      const result = discardAndDraw(this.engine, client.sessionId, msg.cardIds, msg.drawSource);
      this.broadcast(MSG.ANIM, {
        type: 'discard',
        playerId: client.sessionId,
        cards: discardedCards,
      });
      this.broadcast(MSG.ANIM, {
        type: 'draw',
        playerId: client.sessionId,
        source: msg.drawSource,
      });
      this.syncPublic();
      this.sendHand(client.sessionId);
      this.startTurnTimer();
    } catch (e: any) {
      client.send(MSG.ERROR, { reason: e.message });
    }
  }

  private handleYaniv(client: Client) {
    if (this.state.phase !== 'playing') return;
    if (!canYaniv(this.engine, client.sessionId)) {
      client.send(MSG.ERROR, { reason: 'cannot-call-yaniv' });
      return;
    }
    this.clearTurnTimer();
    const active = activePlayers(this.engine);
    const out = resolveRound(
      active.map((p) => ({ playerId: p.id, hand: p.hand, previousScore: p.score })),
      client.sessionId,
      this.engine.config.scoreLimit
    );

    this.broadcast(MSG.ANIM, { type: 'yaniv', playerId: client.sessionId });
    if (out.asaf) this.broadcast(MSG.ANIM, { type: 'asaf', playerId: out.asafById! });

    // עדכון ניקוד + הדחות
    for (const res of out.results) {
      const ep = this.engine.players.find((p) => p.id === res.playerId)!;
      ep.score = res.totalScore;
      if (res.eliminated) ep.out = true;
    }

    this.writeRoundResult(active, out);
    this.state.phase = 'roundEnd';
    this.syncPublic();

    // בדיקת סיום משחק — נשאר שחקן אחד פעיל
    const remaining = this.engine.players.filter((p) => !p.out);
    if (remaining.length <= 1) {
      this.state.gameWinnerId = remaining[0]?.id || out.winnerId;
      this.state.phase = 'gameOver';
      this.syncPublic();
    }
  }

  private handleContinue(client: Client) {
    if (client.sessionId !== this.state.hostId) return;
    if (this.state.phase !== 'roundEnd') return;
    // המנצח של הסיבוב הקודם מתחיל את הבא
    const starter = this.state.roundResult.winnerId;
    this.beginRound(starter);
  }

  // ---------- turn timer ----------

  private startTurnTimer() {
    this.clearTurnTimer();
    if (this.state.phase !== 'playing') return;
    this.turnTimer = setTimeout(() => this.autoPlay(), TURN_MS);
  }

  private clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
  }

  // מהלך אוטומטי אם שחקן לא הגיב בזמן: זורק קלף בעל הערך הגבוה ומושך מהקופה
  private autoPlay() {
    if (this.state.phase !== 'playing') return;
    const cur = currentPlayer(this.engine);
    let worst = cur.hand[0];
    for (const c of cur.hand) if (cardValue(c) > cardValue(worst)) worst = c;
    try {
      discardAndDraw(this.engine, cur.id, [worst.id], 'deck');
      this.broadcast(MSG.ANIM, { type: 'discard', playerId: cur.id, cards: [worst] });
      this.broadcast(MSG.ANIM, { type: 'draw', playerId: cur.id, source: 'deck' });
      this.syncPublic();
      this.sendHand(cur.id);
      this.startTurnTimer();
    } catch {
      /* noop */
    }
  }

  // ---------- helpers ----------

  private removePlayer(sessionId: string) {
    this.state.players.delete(sessionId);
    this.lobbyOrder = this.lobbyOrder.filter((p) => p.id !== sessionId);
    if (this.state.hostId === sessionId) {
      this.state.hostId = this.lobbyOrder[0]?.id || '';
    }
  }

  private syncPublic() {
    // דגל תור
    let curId = '';
    if (this.state.phase === 'playing') curId = currentPlayer(this.engine).id;
    this.state.currentTurnId = curId;

    if (this.engine) {
      this.state.deckCount = this.engine.deck.length;
      // עדכון שחקנים
      for (const ep of this.engine.players) {
        const ps = this.state.players.get(ep.id);
        if (!ps) continue;
        ps.handCount = ep.hand.length;
        ps.score = ep.score;
        ps.out = ep.out;
        ps.isTurn = ep.id === curId;
      }
      // ערימת זריקה ציבורית עם דגל pickable לקצוות
      const pickable = new Set(pickableCards(this.engine.discard).map((c) => c.id));
      this.state.discard.clear();
      for (const c of this.engine.discard) {
        const cs = new CardState();
        cs.id = c.id;
        cs.suit = c.suit || '';
        cs.rank = c.rank;
        cs.joker = c.joker;
        cs.pickable = pickable.has(c.id);
        this.state.discard.push(cs);
      }
    }
  }

  private writeRoundResult(active: { id: string }[], out: ReturnType<typeof resolveRound>) {
    const rr = this.state.roundResult;
    rr.callerId = out.callerId;
    rr.callerValue = out.callerValue;
    rr.asaf = out.asaf;
    rr.asafById = out.asafById || '';
    rr.winnerId = out.winnerId;
    rr.players.clear();
    for (const res of out.results) {
      const ep = this.engine.players.find((p) => p.id === res.playerId)!;
      const pr = new PlayerResult();
      pr.playerId = res.playerId;
      pr.handValue = res.handValue;
      pr.roundScore = res.roundScore;
      pr.totalScore = res.totalScore;
      pr.eliminated = res.eliminated;
      for (const c of ep.hand) {
        const rc = new RevealCard();
        rc.id = c.id;
        rc.suit = c.suit || '';
        rc.rank = c.rank;
        rc.joker = c.joker;
        pr.hand.push(rc);
      }
      rr.players.push(pr);
    }
    this.state.hasResult = true;
  }

  private sendAllHands() {
    for (const ep of this.engine.players) this.sendHand(ep.id);
  }

  private sendHand(sessionId: string) {
    const ep = this.engine?.players.find((p) => p.id === sessionId);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (!ep || !client) return;
    // canYaniv תלוי-ערך בלבד (≤סף) — בדיקת התור נעשית בצד הלקוח מול ה-state הציבורי,
    // וה-authority האמיתי הוא handleYaniv בשרת
    const value = handValue(ep.hand);
    client.send(MSG.HAND, {
      cards: ep.hand,
      value,
      canYaniv: value <= this.state.yanivThreshold,
    });
  }
}
