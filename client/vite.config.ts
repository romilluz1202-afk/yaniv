import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// הלקוח מייבא טיפוסים משותפים מ-../shared — מאפשרים גישה מחוץ ל-root
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
  server: {
    fs: { allow: ['..'] },
    proxy: {
      // בפיתוח: העברת קריאות API ו-WebSocket לשרת Colyseus
      '/api': 'http://localhost:2567',
      '/matchmake': 'http://localhost:2567',
    },
  },
});
