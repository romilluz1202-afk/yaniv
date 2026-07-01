// מיפוי קוד-חדר → roomId, כדי לאפשר הצטרפות לפי קוד קצר וידידותי
export const roomRegistry = new Map<string, string>();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ללא תווים מבלבלים (0/O/1/I)

export function generateRoomCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  } while (roomRegistry.has(code));
  return code;
}
