// תרגום קודי שגיאה מהשרת להודעות עבריות
const MAP: Record<string, string> = {
  'room-not-found': 'לא נמצא חדר עם הקוד הזה',
  'connect-failed': 'החיבור לשרת נכשל, נסה שוב',
  'join-failed': 'ההצטרפות נכשלה, בדוק את הקוד',
  'need-2-players': 'צריך לפחות 2 שחקנים כדי להתחיל',
  'not-your-turn': 'זה לא התור שלך',
  'card-not-in-hand': 'הקלף לא נמצא ביד',
  'invalid-combo': 'הצירוף לא חוקי — קלף בודד, סט, או רצף בלבד',
  'no-cards': 'לא נבחרו קלפים',
  'cannot-call-yaniv': 'אי אפשר להכריז יניב עכשיו',
  'deck-empty': 'הקופה ריקה',
  'nothing-to-pick': 'אין קלף להרים',
  'invalid-pickup': 'את הקלף הזה אי אפשר לקחת',
  'no-slap': 'חלון ההדבקה נסגר',
  'wrong-slap-card': 'אפשר להדביק רק את הקלף שנמשך',
};

export function heError(code: string | null): string {
  if (!code) return '';
  return MAP[code] || 'משהו השתבש, נסה שוב';
}
