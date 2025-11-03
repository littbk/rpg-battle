import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors"; // Adicionado para CORS
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import characterManager from "./lib/charManager";

dotenv.config({ path: "../.env" }); // OK, mas certifique-se de que .env tem as vars certas

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- CONEXÃO COM O BANCO DE DADOS ---
const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
console.log(`Tentando abrir o banco de dados em: ${dbPath}`);

const db = new Database(dbPath, { verbose: console.log });
console.log(`Conectado ao banco de dados em: ${dbPath}`);

const app = express();
const port = process.env.PORT || 3001; // Use PORT do .env ou 3001

app.use(express.json());
app.use(cors({
  origin: ['https://*.discordsays.com', 'https://rpg-battle-psi.vercel.app', 'http://localhost:*'], // Permite origens do Discord e local
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.post("/api/token", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código de autorização ausente' });

  try {
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID, // Mudei de VITE_ para padrão server
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: 'https://rpg-battle-psi.vercel.app/' // ⚠️ ADICIONADO: Obrigatório! Deve combinar com o Redirect URI no Portal do Discord
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro na troca de token:', errorData);
      return res.status(response.status).json({ error: 'Falha na autenticação com Discord', details: errorData });
    }

    const { access_token } = await response.json();
    console.log('Access token gerado:', access_token);
    res.json({ access_token }); // Retorne JSON correto
  } catch (error) {
    console.error('Erro no /api/token:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Os outros endpoints permanecem iguais, mas adicionei logs/tratamentos extras se quiser
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

    const stmt = db.prepare('SELECT * FROM players WHERE discord_id = ?');
    const playerData = stmt.get(discordId);

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

app.get("/api/get-battle-queue", (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM Batalhas WHERE id = 1');
    const battleData = stmt.get();

    if (battleData && battleData.fila) {
      res.json(battleData);
    } else {
      res.status(404).json({ error: 'Batalha (id: 1) não encontrada ou fila vazia' });
    }
  } catch (error) {
    console.error("Erro em /api/get-battle-queue:", error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar fila' });
  }
});

app.get("/api/retornar-ficha", async (req, res) => {
  try {
    const user = JSON.parse(req.query.user);
    console.log(user.username, user.id, user.avatar);

    let message = { author: { username: user.username, id: user.id } };
    let p = await characterManager.getCharacterJson(message);
    res.json(p);
  } catch (error) {
    console.error("Erro em /api/retornar-ficha:", error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar ficha' });
  }
});

// Seus outros códigos (proxy-image, get-ficha) permanecem iguais...

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});