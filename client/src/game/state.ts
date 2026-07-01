// עזרי קריאה מ-schema של Colyseus (MapSchema / ArraySchema) למערכים רגילים
export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  handCount: number;
  score: number;
  connected: boolean;
  isTurn: boolean;
  out: boolean;
}

export function getPlayers(state: any): PlayerView[] {
  const out: PlayerView[] = [];
  state.players?.forEach((p: any) => {
    out.push({
      id: p.id,
      name: p.name,
      seat: p.seat,
      handCount: p.handCount,
      score: p.score,
      connected: p.connected,
      isTurn: p.isTurn,
      out: p.out,
    });
  });
  return out.sort((a, b) => a.seat - b.seat);
}

export function getDiscard(state: any): any[] {
  const arr: any[] = [];
  state.discard?.forEach((c: any) => arr.push(c));
  return arr;
}
