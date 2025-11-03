// Trigger deploy

// --- LÓGICA DA API ---
// (Não há problema em deixar aqui por enquanto)
const PRODUCTION_URL = import.meta.env.VITE_API_URL;
const API_BASE_URL = import.meta.env.DEV 
  ? '/api' 
  : PRODUCTION_URL;

// ⚠️ FIX 1: Removido o 'export default API_BASE_URL;' 
// Ele não tinha efeito aqui.

import { DiscordSDK } from "@discord/embedded-app-sdk";
import rocketLogo from '/rocket.png';
import "./style.css";

// --- VARIÁVEIS GLOBAIS ---
let auth;
// ⚠️ FIX 3: 'isSdkReady' deve começar como 'false'.
// O loop só deve rodar DEPOIS que o SDK estiver pronto.
let isSdkReady = false; 

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
console.log('env')
console.log(import.meta.env.VITE_DISCORD_CLIENT_ID)


// ⚠️ FIX 2: Chamando a inicialização do SDK APENAS UMA VEZ.
setupDiscordSdk().then(() => {
  console.log("Discord SDK está autenticado e pronto.");
  
  // Agora que está pronto, ativamos o loop de polling
  isSdkReady = true;

  // ⚠️ FIX 4: Funções que só rodam UMA VEZ.
  // Chame-as aqui, DEPOIS da autenticação, e não dentro do loop.
  appendUserAvatar();
  appendChannelName();
  
  // Chame a fila de batalha uma vez imediatamente para carregar
  fetchBattleQueue(); 

}).catch((err) => {
    console.error("Erro fatal no setup do SDK:", err);
    // TODO: Mostrar um erro para o usuário na interface
});


async function testApi() {
  try {
    // Note que estou usando a variável API_BASE_URL que definimos lá em cima
    const response = await fetch(`${API_BASE_URL}/alguma-rota`);
    const data = await response.json();
    console.log(data);
  } catch (err) {
    console.error("Erro ao testar API:", err);
  }
}

// Chamada de teste (opcional)
// testApi();


async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
    // "applications.commands" // Geralmente não é necessário para Activities
    ],
  });

  // Retrieve an access_token from your activity's server
  // Note o uso do API_BASE_URL aqui (ou /api que o proxy pega)
  const response = await fetch(`${API_BASE_URL}/api/token`, { // Ajuste esta rota se necessário
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });

  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

document.querySelector('#app').innerHTML = `
  <div>
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h2 id="activity-channel"></h2>
    
    <h3>Ordem de Turno</h3>
    <div id="turn-order-list">
      <p>Carregando fila de batalha...</p>
    </div>
    <h3 id="channel-name"></h2>
  </div>
`;

/**
 * Puxa o nome do canal de voz atual via Discord SDK RPC e atualiza a UI.
 */
async function appendChannelName() {
    const app = document.querySelector('#channel-name');
    if (app) {
        app.innerHTML = '<p>Carregando nome do canal...</p>';
    }
    
    let activityChannelName = 'Unknown';
    if (discordSdk.channelId && discordSdk.guildId) {
        try {
            const channel = await discordSdk.commands.getChannel({
                channel_id: discordSdk.channelId
            });

            console.log('Channel Data Received:', channel);

            if (channel && channel.name) {
                activityChannelName = channel.name;
            } else {
                console.warn("getChannel retornou sem nome ou objeto de canal válido.");
                activityChannelName = "Canal Desconhecido (API)";
            }
            
        } catch (error) {
            console.error("Erro RPC. Falha ao obter o canal.", error);
            activityChannelName = "Canal da Atividade (RPC Falhou)"; 
        }
    } else {
        activityChannelName = "Fora de Contexto de Atividade";
    }

    const textTagString = `Activity Channel: "${activityChannelName}"`;
    const textTag = document.createElement('p');
    textTag.textContent = textTagString;
    
    if (app) {
        app.innerHTML = textTag.outerHTML;
    }
}

async function appendUserAvatar() {
  const logoImg = document.querySelector('img.logo');
  if (!logoImg || !auth) { // Adicionado verificação de !auth
      console.warn("appendUserAvatar chamado sem autenticação ou sem <img>");
      return; 
  }

  // 1️⃣ Busca os dados do usuário autenticado
  const user = await fetch(`https://discord.com/api/v10/users/@me`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());

  // 2️⃣ Monta a URL do avatar
  let avatarUrl
  if (user.avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`;
  } else {
    const defaultAvatarIndex = user.discriminator % 5; 
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
  }

  // 3️⃣ Substitui a imagem do logo pelo avatar do usuário
  logoImg.src = avatarUrl;
  logoImg.alt = `${user.username} avatar`;
  logoImg.width = 128;
  logoImg.height = 128;
  logoImg.style.borderRadius = '50%';
}


async function fetchBattleQueue() {
  const channelId = discordSdk.channelId;
  const turnOrderContainer = document.querySelector('#turn-order-list');

  if (!channelId) { 
    if (turnOrderContainer) turnOrderContainer.innerHTML = "<p>ID do Canal não encontrado.</p>";
    return;
  }

  try {
    // Usa a variável API_BASE_URL
    const response = await fetch(`${API_BASE_URL}/api/get-battle-queue?channel=${channelId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
    }

    const battleData = await response.json();
    console.log(battleData)
    const fila = JSON.parse(battleData.fila);
    const jogadorAtual = battleData.jogadorAtual;

    if (jogadorAtual) {
      const indiceDoJogador = fila.findIndex(jogador => 
          jogador.nome === jogadorAtual
      );
      if (indiceDoJogador !== -1) {
          const [jogadorPrioritario] = fila.splice(indiceDoJogador, 1);
          jogadorPrioritario.step = 9999;
          fila.unshift(jogadorPrioritario);
      }
    }
    
    const lutadoresAtivos = fila.filter(p => p.ativo === true);
    lutadoresAtivos.sort((a, b) => b.step - a.step);

    if (lutadoresAtivos.length > 0) {
      const lutadorPrioritario = lutadoresAtivos.shift(); 
      const primeiroItemHtml = `<li><strong class="prioritario">${lutadorPrioritario.nome}</strong> (Step: ${lutadorPrioritario.step})</li>`;
      const restanteItensHtml = lutadoresAtivos.map(player => 
        `<li><strong>${player.nome}</strong> (Step: ${player.step})</li>`
      ).join('');
      const htmlList = `<ol>${primeiroItemHtml}${restanteItensHtml}</ol>`;
      turnOrderContainer.innerHTML = htmlList;
    } else {
      turnOrderContainer.innerHTML = "<p>Nenhum lutador ativo na fila.</p>";
    }

  } catch (error) {
    console.error("Falha ao buscar fila de batalha:", error);
    if (turnOrderContainer) {
      turnOrderContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
  }
}


// --- LOOP DE ATUALIZAÇÃO (POLLING) ---

// ⚠️ FIX 4: O loop agora só cuida da fila de batalha.
setInterval(() => {
  // Só roda a função se o SDK estiver pronto (isSdkReady é true)
  if (isSdkReady) {
    fetchBattleQueue();
  }
}, 2000); // 2000ms = 2 segundos.