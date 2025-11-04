import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import pg from 'pg'; // 1. Trocado 'better-sqlite3' por 'pg'

// --- CONFIGURAÇÃO DE AMBIENTE ---
// Isto só vai carregar o .env em desenvolvimento. Em produção (Render),
// as variáveis já são injetadas pelo "Environment" do Render.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: "../.env" });
}

// --- CONEXÃO COM O BANCO DE DADOS (AGORA POSTGRESQL) ---
// 2. Removemos toda a lógica de 'path' e 'dbPath'.
// Usamos Pool em vez de Client, pois é muito melhor para um servidor web
// (gere múltiplas conexões automaticamente).
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // 3. Necessário para as conexões gratuitas do Render
    rejectUnauthorized: false 
  }
});

// Teste de conexão opcional
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("!!! ERRO FATAL AO CONECTAR AO BANCO DE DADOS POSTGRESQL:", err);
  } else {
    console.log("--- Conectado com sucesso ao PostgreSQL no Render. ---");
  }
});


const app = express();
// 4. O Render fornece a porta via process.env.PORT (geralmente 10000)
const port = process.env.PORT || 3001; 

app.use(express.json());

// --- CONFIGURAÇÃO DE CORS (SEGURANÇA) ---
// 5. Configuração de CORS mais segura, lendo a URL do seu client (Vercel)
//    a partir das variáveis de ambiente.
const allowedOrigins = [
  process.env.CLIENT_URL, // Sua URL do Vercel (ex: https://rpg-battle-psi.vercel.app)
  'http://localhost:5173'  // Seu client local
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite chamadas sem 'origin' (ex: Postman) ou da nossa lista
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

app.post("/api/token", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código de autorização ausente' });

  // 6. O redirect_uri NÃO PODE ser hardcoded. 
  //    Deve ser a mesma URL do seu client (Vercel).
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
      redirect_uri: process.env.CLIENT_URL // 7. Usando a variável de ambiente
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

    // 8. SINTAXE DE QUERY MUDOU DE SQLITE PARA POSTGRESQL
    // SQLite: db.prepare('... = ?').get(discordId)
    // Postgre: pool.query('... = $1', [discordId])
    const query = 'SELECT * FROM players WHERE discord_id = $1';
    const result = await pool.query(query, [discordId]);
    
    const playerData = result.rows[0]; // O resultado fica em 'rows'

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
    // 9. SINTAXE DE QUERY MUDOU
    const query = 'SELECT * FROM Batalhas WHERE id = $1';
    const result = await pool.query(query, [1]); // Usando 1 como parâmetro

    const battleData = result.rows[0];

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

/*
app.get("/api/retornar-ficha", async (req, res) => {
  // ... Este código também precisaria ser migrado para usar pool.query ...
});
*/

app.listen(port, () => {
  // 10. A porta 10000 (do Render) não é acessível publicamente. 
  // O Render faz o proxy para 443 (https) automaticamente.
  // O localhost:3001 é para si.
  console.log(`Servidor a ouvir na porta ${port}`);
});
