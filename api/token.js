import fetch from 'node-fetch';
import pg from 'pg';

// Conecta-se ao banco de dados (lê o DATABASE_URL do ambiente)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// A função 'handler' é o que a Vercel executa
export default async function handler(req, res) {
  // Configuração de CORS (importante)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL); // A sua URL do Vercel
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send({ error: 'Method Not Allowed' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código de autorização ausente' });

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
      return res.status(response.status).json({ error: 'Falha na autenticação com Discord', details: errorData });
    }

    const { access_token } = await response.json();
    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Erro no /api/token:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}