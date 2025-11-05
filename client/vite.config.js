import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // CORREÇÃO 1: Esta linha estava CORRETA.
  // Ela diz ao Vite para carregar o arquivo .env da pasta raiz do projeto.
  envDir: '../', 

  server: {
    host: 'localhost',
    port: 5173,
    https: false,
    cors: true,
    headers: {
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Embedder-Policy': 'unsafe-none',
  },
    // Isto continua correto para permitir o acesso via Cloudflare Tunnel
    allowedHosts: [
      'dimension-cited-gmc-obviously.trycloudflare.com',
       '.trycloudflare.com',
       '.vercel.app',
       'https://rpg-battle-psi.vercel.app/,'
    ],

    proxy: {
      '/api': {
        // ...será redirecionada para o seu backend LOCAL na porta 3001.
        target: 'http://localhost:3001', 
        changeOrigin: true,
        secure: false,
      },

    },
  
  },
});