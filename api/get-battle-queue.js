import pg from 'pg';

// Conecta-se ao banco de dados
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const query = 'SELECT * FROM "Batalhas" WHERE id = $1'; // Nota: "Batalhas" com "B" maiúsculo
    const result = await pool.query(query, [1]); 
    const battleData = result.rows[0];

    if (battleData && battleData.fila) {
      res.status(200).json(battleData);
    } else {
      res.status(404).json({ error: 'Batalha (id: 1) não encontrada ou fila vazia' });
    }
  } catch (error) {
    console.error("Erro em /api/get-battle-queue:", error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar fila' });
  }
}