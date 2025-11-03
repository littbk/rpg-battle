const fetch = require('node-fetch'); // Se não tiver fetch nativo, instale node-fetch

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Código de autorização ausente' });
  }

  try {
    // Use variáveis de ambiente (defina no Vercel Dashboard)
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = 'https://rpg-battle-psi.vercel.app/'; // Deve combinar com a URL da Atividade no Portal do Discord

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Configurações do Discord ausentes no servidor' });
    }

    // Troca o code por access_token na API do Discord
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Erro na troca de token:', errorData);
      return res.status(tokenResponse.status).json({ error: 'Falha na autenticação com Discord', details: errorData });
    }

    const tokenData = await tokenResponse.json();
    return res.status(200).json({ access_token: tokenData.access_token });

  } catch (error) {
    console.error('Erro no endpoint /api/token:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
};