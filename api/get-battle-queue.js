import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send({ error: 'Method Not Allowed' });

  try {
    const query = 'SELECT * FROM "Batalhas" WHERE id = $1'; // Use aspas se o nome da tabela tiver maiúsculas
    const result = await pool.query(query, [1]); 
    const battleData = result.rows[0];

    if (battleData && battleData.fila) {
      res.status(200).json(battleData);
    } else {
      // Se não houver dados, criamos a batalha (como fizemos no bot)
      const createQuery = `
        INSERT INTO "Batalhas" (id, "battleOn", fila, "lutadoresMob", "turnoNumero", "rodadaAnterior", "rodadaAtual", "turnoAtual", "jogadorAtual", "temJogadorAtual", "jogadorAtualId", "lastElem") 
        VALUES (1, false, '[]', '[]', 0, 0, 0, 0, 'Ninguém', false, 0, 0) 
        RETURNING *`;
      const newBattle = await pool.query(createQuery);
      res.status(200).json(newBattle.rows[0]);
    }
  } catch (error) {
    console.error("Erro em /api/get-battle-queue:", error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}