// שכבת רשת — חיבור Colyseus + zustand store שמשקף את מצב המשחק ל-React
import { create } from 'zustand';
import { Client, Room } from 'colyseus.js';
import type { Card, DrawSource, AnimEvent } from '@shared/types';
import { MSG } from '@shared/types';

// כתובת השרת: בפיתוח מול פורט Colyseus, בייצור אותו origin
const SERVER_HTTP = import.meta.env.DEV ? 'http://localhost:2567' : window.location.origin;

interface HandMsg {
  cards: Card[];
  value: number;
  canYaniv: boolean;
}

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
  error: string | null;
  announce: Announce | null;
  connecting: boolean;

  createRoom: (name: string) => Promise<void>;
  joinRoom: (code: string, name: string) => Promise<void>;
  start: () => void;
  setConfig: (config: { yanivThreshold?: number; scoreLimit?: number }) => void;
  discard: (cardIds: string[], drawSource: DrawSource) => void;
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

  room.onMessage(MSG.HAND, (msg: HandMsg) => {
    set({ hand: msg.cards, handValue: msg.value, canYaniv: msg.canYaniv });
  });

  room.onMessage(MSG.ERROR, (msg: { reason: string }) => {
    set({ error: msg.reason });
  });

  room.onMessage(MSG.ANIM, (ev: AnimEvent) => {
    if (ev.type === 'yaniv') set({ announce: { type: 'yaniv', playerId: ev.playerId, ts: Date.now() } });
    if (ev.type === 'asaf') set({ announce: { type: 'asaf', playerId: ev.playerId, ts: Date.now() } });
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
  error: null,
  announce: null,
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
  discard: (cardIds, drawSource) => get().room?.send('discard', { cardIds, drawSource }),
  callYaniv: () => get().room?.send('yaniv'),
  continueGame: () => get().room?.send('continue'),
  leave: () => {
    get().room?.leave();
    set({ room: null, connected: false, hand: [], stateVersion: 0 });
  },
  clearError: () => set({ error: null }),
  clearAnnounce: () => set({ announce: null }),
}));
