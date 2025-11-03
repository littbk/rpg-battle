import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import characterManager from "../../lib/managers/charManager.js";


dotenv.config({ path: "../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- CONEXÃO COM O BANCO DE DADOS ---
const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
console.log(`Tentando abrir o banco de dados em: ${dbPath}`);

const db = new Database(dbPath, { verbose: console.log }); // Removi readonly para permitir escrita se necessário, mas mantive leitura
console.log(`Conectado ao banco de dados em: ${dbPath}`);

const app = express();
const port = 3001;

app.use(express.json());

app.post("/api/token", async (req, res) => {
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });
  const { access_token } = await response.json();
  console.log(access_token);
  res.send({ access_token });
});



app.get("/api/get-player-data", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).send('Não autorizado: Token não fornecido');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!userResponse.ok) return res.status(403).send('Token inválido');

    const discordUser = await userResponse.json();
    const discordId = discordUser.id;

    //// PEGA A BATALHA NO BANCO
    const stmt = db.prepare('SELECT * FROM players WHERE discord_id = ?');
    const playerData = stmt.get(discordId);

    if (playerData) {
      res.send(playerData);
    } else {
      res.status(404).send('Jogador não encontrado no banco de dados');
    }
  } catch (error) {
    console.error("Erro em /api/get-player-data:", error);
    res.status(500).send('Erro interno do servidor');
  }
});


app.get("/api/get-battle-queue", async (req, res) => {
  try {
    /// BUSCA A BATALHA NO BANCO
//    const stmt = db.prepare('SELECT fila FROM Batalhas WHERE id = 1');
const stmt = db.prepare('SELECT * FROM Batalhas WHERE id = 1');
    const battleData = stmt.get(); // .get() é o suficiente

    if (battleData && battleData.fila) {
      //// RETORNA O BANCO EM JSON
      //const filaArray = JSON.parse(battleData.fila);
      res.json(battleData);
    } else {
      res.status(404).send('Batalha (id: 1) não encontrada ou fila vazia');
    }
  } catch (error) {
    console.error("Erro em /api/get-battle-queue:", error);
    res.status(500).send('Erro interno do servidor ao processar fila');
  }
});


app.get("/api/retornar-ficha", async (req, res) => {
  try {

    const user = JSON.parse(req.query.user);

   console.log(user.username, user.id, user.avatar);

    
    let message = []
    message.author = []
    message.author.username = user.username
    message.author.id = user.id
    let p = await characterManager.getCharacterJson(message)
    res.json(p);
    
  } catch (error) {
    console.error("Erro em /api/get-battle-queue:", error);
    res.status(500).send('Erro interno do servidor ao processar fila');
  }
});

const DISCORD_HOSTS = [
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images-ext-1.discordapp.net",
];

// Função auxiliar para validar URLs (deve ser implementada por você)
function isAllowedUrl(inputUrl) {
    try {
        const url = new URL(inputUrl);
        // Permite Discord e seu novo host (i.ibb.co)
        const allowedHosts = [...DISCORD_HOSTS, "i.ibb.co"]; 
        return allowedHosts.includes(url.hostname);
    } catch (e) {
        return false;
    }
}
  

app.get('/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    // 1. Validação de segurança: Use a URL DECODIFICADA para verificar o host
    const decodedUrl = decodeURIComponent(url);
    if (!isAllowedUrl(decodedUrl)) {
        // Agora aceita Discord E i.ibb.co
        return res.status(400).send('Only allowed image CDN URLs are permitted');
    }

    try {
        const headers = {
            // 🔑 CORREÇÃO CRÍTICA: Adiciona um User-Agent de navegador para evitar bloqueio 403/404 do CDN.
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            
            // Omissão de Referer: Em Node.js (com fetch), o Referer NÃO é enviado por padrão 
            // em requisições de servidor para servidor, o que é o comportamento desejado. 
            // Isso evita o bloqueio 404/403 do Discord.
        };

        // 2. Se a imagem é do Discord e o token está disponível (para canais privados)
        if (DISCORD_HOSTS.some(host => decodedUrl.includes(host)) && process.env.DISCORD_BOT_TOKEN) {
             headers['Authorization'] = `Bot ${process.env.DISCORD_BOT_TOKEN}`;
        }
        // Se a imagem NÃO é do Discord (ex: i.ibb.co), o cabeçalho Authorization é OMITIDO, o que está correto.

        // 3. Faz a requisição usando a URL DECODIFICADA
        const imageResponse = await fetch(decodedUrl, { headers });

        if (!imageResponse.ok) {
            console.error(`Fetch failed with status ${imageResponse.status} for URL: ${decodedUrl}`);
            return res.status(imageResponse.status).send('Failed to fetch image from external source');
        }

        // 4. Propaga content-type e cache-control
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        res.setHeader('Content-Type', contentType);
        
        // Use um cache mais longo para imagens estáticas, 1 ano (86400 * 365)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); 

        // 5. Stream direto para o cliente
        imageResponse.body.pipe(res);
    } catch (err) {
        console.error('Proxy error:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint para buscar a ficha do jogador pelo discord_id
app.get('/api/get-ficha', (req, res) => {
  try {
    const { userId } = req.query; // Pega o ?userId=... (discord_id numérico)
    if (!userId) return res.status(400).json({ error: 'userId não fornecido' });

    console.log(`[API /get-ficha] Recebido pedido para ficha do usuário ID: ${userId}`);

    // Busca no banco de dados
    const stmt = db.prepare('SELECT * FROM players WHERE discord_id = ?');
    const player = stmt.get(userId);

    if (player) {
      res.json(player); // Retorna o objeto completo do jogador (incluindo nome)
    } else {
      console.warn(`[API /get-ficha] Jogador ID ${userId} não encontrado no DB.`);
      res.status(404).json({ error: 'Jogador não encontrado' });
    }
  } catch (error) {
    console.error('[API /get-ficha] Erro ao buscar ficha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
 


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
}); 