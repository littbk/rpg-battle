import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../',
  server: {
    host: 'localhost',
    port: 5173,
    https: false, // ou true se tiver certificado válido
    allowedHosts: [
        'dimension-cited-gmc-obviously.trycloudflare.com',
    ],
    proxy: {
      '/api': {
        target: 'https://rpg-battle-pi.vercel.app/',
        changeOrigin: true,
        secure: false,
      },
      '/.proxy': {
        target: 'https://rpg-battle-pi.vercel.app/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/\.proxy/, ''),
      },
    },
    cors: {
      origin: [
        'https://rpg-battle-pi.vercel.app/',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  },
});
