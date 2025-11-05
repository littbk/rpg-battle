/*
  ESTE É O SEU `server.js` COMPLETO.
  Ele agora inclui o discord.js (Bot) e os endpoints da API
  que o seu `main.js` (Frontend) precisa.
*/
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import pg from 'pg';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'; // 1. ⭐️ ADICIONADO discord.js

// --- CONFIGURAÇÃO DE AMBIENTE ---
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: "../.env" });
}

// --- INICIALIZAÇÃO DO BOT (DISCORD.JS) ---
// 2. ⭐️ CRÍTICO: O seu bot precisa estar logado para as APIs funcionarem.
const botClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ⭐️ NOTA: Pode precisar disto para ler o conteúdo das mensagens
    GatewayIntentBits.GuildVoiceStates // Necessário para /get-voice-participants
  ]
});

// Certifique-se de que DISCORD_BOT_TOKEN está no seu ficheiro .env
console.log('-=========================================')
console.log(process.env.DISCORD_BOT_TOKEN)
botClient.login(process.env.DISCORD_BOT_TOKEN);
botClient.once('ready', () => {
  console.log(`--- Bot ${botClient.user.tag} está online! ---`);
});


// --- CONEXÃO COM O BANCO DE DADOS (POSTGRESQL) ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("!!! ERRO FATAL AO CONECTAR AO BANCO DE DADOS POSTGRESQL:", err);
  } else {
    console.log("--- Conectado com sucesso ao PostgreSQL no Render. ---");
  }
});


// --- CONFIGURAÇÃO DO SERVIDOR (EXPRESS) ---
const app = express();
const port = process.env.PORT || 3001;

// 3. ⭐️ CORREÇÃO: express.json() é o correto. Não é preciso body-parser.
app.use(express.json());

// --- CONFIGURAÇÃO DE CORS (SEGURANÇA) ---
const allowedOrigins = [
  process.env.CLIENT_URL, // Sua URL do Vercel
  'http://localhost:5173' // Seu client local
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS BLOQUEADO: Origem não permitida: ${origin}`);
      callback(new Error('Não permitido por CORS'));
    }
  }
}));

// --- ROTA DE "SAÚDE" (HEALTH CHECK) ---
app.get("/", (req, res) => {
  res.send("Servidor da API do RPG Battle está no ar! 🚀");
});


// --- ROTAS DA API ---

// (A sua rota /api/token permanece igual)
app.post("/api/token", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código de autorização ausente' });

  if (!process.env.CLIENT_URL) {
    console.error("ERRO: CLIENT_URL não está definido nas variáveis de ambiente!");
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.CLIENT_URL
    });

    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro na troca de token:', errorData);
      return res.status(response.status).json({ error: 'Falha na autenticação com Discord', details: errorData });
    }

    const { access_token } = await response.json();
    console.log('Access token gerado com sucesso.');
    res.json({ access_token });
  } catch (error) {
    console.error('Erro no /api/token:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// (A sua rota /api/get-player-data permanece igual)
app.get("/api/get-player-data", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Não autorizado: Token não fornecido' });

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!userResponse.ok) return res.status(403).json({ error: 'Token inválido' });

    const discordUser = await userResponse.json();
    const discordId = discordUser.id;

    const query = 'SELECT * FROM players WHERE discord_id = $1';
    const result = await pool.query(query, [discordId]);

    const playerData = result.rows[0];

    if (playerData) {
      res.json(playerData);
    } else {
      res.status(404).json({ error: 'Jogador não encontrado no banco de dados' });
    }
  } catch (error) {
    console.error("Erro em /api/get-player-data:", error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


app.get("/api/get-battle-queue", async (req, res) => {
  try {

    // 4. ⭐️ CORREÇÃO: A rota agora usa o channelId vindo do frontend
    const { channel: channelId } = req.query;
    if (!channelId) {
      return res.status(400).json({ error: 'ID do Canal ausente' });
    }

    // 5. ⭐️ CORREÇÃO: Usamos o [channelId] como parâmetro
    // (Assumindo que a coluna 'id' na tabela "Batalhas" é o ID do canal)
    const query = 'SELECT * FROM "Batalhas" WHERE id = $1';
    const result = await pool.query(query, [channelId]);

    const battleData = result.rows[0];

    if (battleData && battleData.fila) {
      res.json(battleData);
    } else {
      res.status(404).json({ error: `Batalha (id: ${channelId}) não encontrada ou fila vazia` });
    }
  } catch (error) {
    console.error("Erro em /api/get-battle-queue:", error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar fila' });
  } // ⭐️ CORREÇÃO: O 'D' ALEATÓRIO FOI REMOVIDO DAQUI
});

// --- 6. ⭐️ ADICIONADO: ENDPOINT PARA A PÁGINA DE FICHA ---
app.get('/api/get-voice-participants', async (req, res) => {
  try {
    const { channel: channelId } = req.query;
    if (!channelId) {
      return res.status(400).json({ error: 'ID do Canal ausente' });
    }

    // Usa o Bot (botClient) para encontrar o canal de voz
    const channel = await botClient.channels.fetch(channelId);
    if (!channel || !channel.isVoiceBased()) {
      return res.status(404).json({ error: 'Canal de voz não encontrado' });
    }

    // Mapeia os membros no canal para o formato que o frontend espera
    const participants = channel.members.map(member => {
      return {
        id: member.user.id,
        username: member.user.globalName || member.user.username,
        avatarUrl: member.user.displayAvatarURL({ dynamic: true, size: 128 })
      };
    });

    res.json(participants);

  } catch (error) {
    console.error("Erro em /api/get-voice-participants:", error);
    res.status(500).json({ error: 'Erro ao buscar participantes' });
  }
});


// --- 7. ⭐️ ADICIONADO: ENDPOINT PARA CARREGAR O CHAT ---
app.get('/api/get-chat-messages', async (req, res) => {
  try {
    
    const { channel: channelId } = req.query;
    if (!channelId) {
      return res.status(400).json({ error: 'ID do Canal ausente' });
    }

    // Usa o Bot (botClient) para encontrar o canal de texto
    const channel = await botClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Canal de texto não encontrado' });
    }

    // Busca as 7 últimas mensagens
    const messages = await channel.messages.fetch({ limit: 7 });

    // Mapeia as mensagens para um formato JSON simples
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.globalName || msg.author.username,
        avatar: msg.author.displayAvatarURL({ dynamic: true, size: 64 })
      }
    }));

    // O frontend renderiza do mais antigo para o mais novo
    res.json(formattedMessages.reverse());

  } catch (error) {
    console.error("Erro em /api/get-chat-messages:", error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});


// --- 8. ⭐️ ADICIONADO: ENDPOINT PARA ENVIAR MENSAGENS NO CHAT ---
app.post('/api/send-chat-message', async (req, res) => {
  try {
    const { channelId, content, author } = req.body;
    if (!channelId || !content || !author) {
      return res.status(400).json({ error: 'Dados ausentes (channelId, content, author)' });
    }

    // Usa o Bot (botClient) para encontrar o canal de texto
    const channel = await botClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Canal de texto não encontrado' });
    }

    // 9. ⭐️ MUDANÇA: Usando o EmbedBuilder do discord.js v14
    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // Cor do Discord
      .setAuthor({ name: author.username, iconURL: author.avatar })
      .setDescription(content);

    // Envia a mensagem no canal de texto como um "Embed"
    await channel.send({ embeds: [embed] });

    res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro em /api/send-chat-message:", error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
  console.log(`Servidor a ouvir na porta ${port}`);
});