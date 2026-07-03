// שכבת רשת — חיבור Colyseus + zustand store שמשקף את מצב המשחק ל-React
import { create } from 'zustand';
import { Client, Room } from 'colyseus.js';
import type { Card, DrawSource, AnimEvent, PrivateHand } from '@shared/types';
import { MSG } from '@shared/types';

// כתובת השרת: בפיתוח מול פורט Colyseus, בייצור אותו origin
const SERVER_HTTP = import.meta.env.DEV ? 'http://localhost:2567' : window.location.origin;

export interface Announce {
  type: 'yaniv' | 'asaf';
  playerId: string;
  ts: number;
}

interface NetStore {
  client: Client | null;
  room: Room | null;
  sessionId: string;
  connected: boolean;
  stateVersion: number; // עולה בכל onStateChange כדי לרנדר מחדש
  hand: Card[];
  handValue: number;
  canYaniv: boolean;
  slapCardId: string | null; // קלף שניתן להדביק עכשיו
  error: string | null;
  errorSeq: number;
  announce: Announce | null;
  lastAnim: AnimEvent | null; // האירוע האחרון — Table מאזין לפי animSeq
  animSeq: number;
  connecting: boolean;

  createRoom: (name: string) => Promise<void>;
  joinRoom: (code: string, name: string) => Promise<void>;
  start: () => void;
  setConfig: (config: { yanivThreshold?: number; scoreLimit?: number }) => void;
  discard: (cardIds: string[], drawSource: DrawSource, pickupId?: string) => void;
  slap: (cardId: string) => void;
  callYaniv: () => void;
  continueGame: () => void;
  leave: () => void;
  clearError: () => void;
  clearAnnounce: () => void;
}

function getClient(get: () => NetStore, set: (p: Partial<NetStore>) => void): Client {
  let c = get().client;
  if (!c) {
    c = new Client(SERVER_HTTP);
    set({ client: c });
  }
  return c;
}

function wireRoom(room: Room, set: (p: Partial<NetStore>) => void, get: () => NetStore) {
  set({ room, sessionId: room.sessionId, connected: true, error: null, connecting: false });

  room.onStateChange(() => {
    set({ stateVersion: get().stateVersion + 1 });
  });

  room.onMessage(MSG.HAND, (msg: PrivateHand) => {
    set({
      hand: msg.cards,
      handValue: msg.value,
      canYaniv: msg.canYaniv,
      slapCardId: msg.slapCardId ?? null,
    });
  });

  room.onMessage(MSG.ERROR, (msg: { reason: string }) => {
    set({ error: msg.reason, errorSeq: get().errorSeq + 1 });
  });

  room.onMessage(MSG.ANIM, (ev: AnimEvent) => {
    if (ev.type === 'yaniv') set({ announce: { type: 'yaniv', playerId: ev.playerId, ts: Date.now() } });
    if (ev.type === 'asaf') set({ announce: { type: 'asaf', playerId: ev.playerId, ts: Date.now() } });
    set({ lastAnim: ev, animSeq: get().animSeq + 1 });
  });

  room.onError((code, message) => set({ error: message || `error-${code}` }));
  room.onLeave(() => set({ connected: false }));
}

export const useNet = create<NetStore>((set, get) => ({
  client: null,
  room: null,
  sessionId: '',
  connected: false,
  stateVersion: 0,
  hand: [],
  handValue: 0,
  canYaniv: false,
  slapCardId: null,
  error: null,
  errorSeq: 0,
  announce: null,
  lastAnim: null,
  animSeq: 0,
  connecting: false,

  createRoom: async (name: string) => {
    set({ connecting: true, error: null });
    try {
      const client = getClient(get, set);
      const room = await client.create('yaniv', { name });
      wireRoom(room, set, get);
    } catch (e: any) {
      set({ error: e?.message || 'connect-failed', connecting: false });
    }
  },

  joinRoom: async (code: string, name: string) => {
    set({ connecting: true, error: null });
    try {
      const res = await fetch(`${SERVER_HTTP}/api/room/${code.toUpperCase()}`);
      if (!res.ok) {
        set({ error: 'room-not-found', connecting: false });
        return;
      }
      const { roomId } = await res.json();
      const client = getClient(get, set);
      const room = await client.joinById(roomId, { name });
      wireRoom(room, set, get);
    } catch (e: any) {
      set({ error: e?.message || 'join-failed', connecting: false });
    }
  },

  start: () => get().room?.send('start'),
  setConfig: (config) => get().room?.send('config', { config }),
  discard: (cardIds, drawSource, pickupId) =>
    get().room?.send('discard', { cardIds, drawSource, pickupId }),
  slap: (cardId) => get().room?.send('slap', { cardId }),
  callYaniv: () => get().room?.send('yaniv'),
  continueGame: () => get().room?.send('continue'),
  leave: () => {
    get().room?.leave();
    set({ room: null, connected: false, hand: [], stateVersion: 0, slapCardId: null });
  },
  clearError: () => set({ error: null }),
  clearAnnounce: () => set({ announce: null }),
}));
