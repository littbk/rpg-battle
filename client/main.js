// --- LÓGICA DA API (CORRIGIDA) ---
// Esta é a lógica final que funciona localmente e em produção.
const PRODUCTION_URL = import.meta.env.VITE_API_URL;

const API_BASE_URL = import.meta.env.DEV 
  ? ''  // Em dev, a "base" é vazia (usaremos caminhos relativos como /api/...)
  : PRODUCTION_URL; // Em produção, a "base" é a URL completa

// --- IMPORTAÇÕES ---
import { DiscordSDK } from "@discord/embedded-app-sdk";
import rocketLogo from '/rocket.png';
import "./style.css";

// --- VARIÁVEIS GLOBAIS ---
let auth;
// Deve começar como 'false'. O loop só roda DEPOIS que o SDK estiver pronto.
let isSdkReady = false; 

// Inicializa o SDK
const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

console.log('Cliente ID do Discord (VITE):', import.meta.env.VITE_DISCORD_CLIENT_ID);


// --- INICIALIZAÇÃO DA APLICAÇÃO ---
// Chamamos a função de setup principal APENAS UMA VEZ.
setupDiscordSdk().then(() => {
  console.log("Discord SDK está autenticado e pronto.");
  
  // Agora que está pronto, ativamos o loop de polling
  isSdkReady = true;

  // Funções que só precisam rodar UMA VEZ (depois da autenticação)
  appendUserAvatar();
  appendChannelName();
  
  // Chame a fila de batalha uma vez imediatamente para carregar a UI
  fetchBattleQueue(); 

}).catch((err) => {
    console.error("Erro fatal no setup do SDK:", err);
    // Aqui você pode adicionar uma mensagem de erro na UI
    document.querySelector('#app').innerHTML = `<p style="color:red;">Falha ao autenticar com o Discord. Por favor, tente recarregar a atividade.</p>`;
});


// --- FUNÇÕES PRINCIPAIS ---

async function setupDiscordSdk() {
  // Espera o SDK estar pronto para comunicar com o cliente Discord
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Autoriza com o cliente Discord
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
    ],
  });

  // Busca o access_token do nosso backend (usando a URL de API correta)
  const response = await fetch(`${API_BASE_URL}/api/token`, { 
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });

  const { access_token } = await response.json();

  // Autentica com o cliente Discord (usando o access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

// --- FUNÇÕES DE ATUALIZAÇÃO DA UI ---

// Injeta o HTML base na página
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
 * Busca e exibe o nome do canal de voz atual.
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

    const textTagString = `Canal: "${activityChannelName}"`;
    const textTag = document.createElement('p');
    textTag.textContent = textTagString;
    
    if (app) {
        app.innerHTML = textTag.outerHTML;
    }
}

/**
 * Busca o avatar do usuário e o exibe no lugar do logo.
 */
async function appendUserAvatar() {
  const logoImg = document.querySelector('img.logo');
  // Garante que a autenticação (auth) aconteceu antes de rodar
  if (!logoImg || !auth) { 
      console.warn("appendUserAvatar chamado sem autenticação ou sem <img>");
      return; 
  }

  // Busca os dados do usuário autenticado
  const user = await fetch(`https://discord.com/api/v10/users/@me`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());

  // Monta a URL do avatar
  let avatarUrl;
  if (user.avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`;
  } else {
    // Usa o avatar padrão para contas sem avatar customizado
    const defaultAvatarIndex = user.discriminator % 5; 
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
  }

  // Substitui a imagem do logo pelo avatar do usuário
  logoImg.src = avatarUrl;
  logoImg.alt = `${user.username} avatar`;
  logoImg.width = 128;
  logoImg.height = 128;
  logoImg.style.borderRadius = '50%';
}

/**
 * Busca os dados da fila de batalha da nossa API e atualiza a UI.
 */
async function fetchBattleQueue() {
  const channelId = discordSdk.channelId;
  const turnOrderContainer = document.querySelector('#turn-order-list');

  // Não faz nada se o SDK ainda não nos deu o ID do canal
  if (!channelId) { 
    if (turnOrderContainer) turnOrderContainer.innerHTML = "<p>ID do Canal não encontrado.</p>";
    return;
  }

  try {
    // Busca na nossa API (usando a URL de API correta)
    const response = await fetch(`${API_BASE_URL}/api/get-battle-queue?channel=${channelId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
    }

    const battleData = await response.json();
    console.log(battleData); // Ótimo para debug
    
    // Processa a fila
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
    
    // Filtra, ordena e exibe
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
// Este loop só atualiza a fila de batalha, que é a única coisa
// que precisa de atualização constante.
setInterval(() => {
  // Só roda a função se o SDK estiver pronto (isSdkReady é true)
  if (isSdkReady) {
    fetchBattleQueue();
  }
}, 2000); // 2000ms = 2 segundos.


// --- FUNÇÃO DE TESTE (Opcional) ---
async function testApi() {
  try {
    // Usa a URL de API correta
    const response = await fetch(`${API_BASE_URL}/api/alguma-rota`);
    const data = await response.json();
    console.log("Resultado do Teste de API:", data);
  } catch (err) {
    console.error("Erro ao testar API:", err);
  }
}
// Descomente a linha abaixo se quiser testar sua rota /api/alguma-rota
// testApi();