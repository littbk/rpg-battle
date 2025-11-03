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
    
    // Isto continua correto para permitir o acesso via Cloudflare Tunnel
    allowedHosts: [
      'dimension-cited-gmc-obviously.trycloudflare.com',
    ],

    proxy: {
      // CORREÇÃO 2: O alvo do proxy mudou.
      // Agora, qualquer chamada para /api...
      '/api': {
        // ...será redirecionada para o seu backend LOCAL na porta 3001.
        target: 'http://localhost:3001', 
        changeOrigin: true,
        secure: false,
      },
      
      // NOTA: Removi o proxy '/.proxy' por ser provavelmente redundante.
      // Se você realmente o utiliza, pode adicioná-lo de volta
      // com o target 'http://localhost:3001'.
    },
    
    // Removemos o 'server.cors' na última etapa, e isso continua correto.
    // O proxy é a forma certa de lidar com o CORS em desenvolvimento.
  },
});