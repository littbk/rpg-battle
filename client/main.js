// --- LÓGICA DA API (CORRIGIDA) ---
// Esta é a lógica correta que decide qual API chamar.
const isDev = import.meta.env.DEV;
const PRODUCTION_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, ''); // remove barra final se existir
const API_BASE_URL = isDev ? '' : PRODUCTION_URL;

console.log(`[INIT] Modo de ${isDev ? 'Desenvolvimento' : 'Produção'}.`);
console.log(`[INIT] API Base: ${API_BASE_URL || 'Relativa (mesmo domínio)'}`);

import { DiscordSDK } from "@discord/embedded-app-sdk";
import rocketLogo from '/rocket.png';
import "./style.css";

// --- VARIÁVEIS GLOBAIS ---
let auth;
let isSdkReady = false; 

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
console.log('Cliente ID do Discord (VITE):', import.meta.env.VITE_DISCORD_CLIENT_ID);


// --- INICIALIZAÇÃO DA APLICAÇÃO ---
setupDiscordSdk().then(() => {
  console.log("Discord SDK está autenticado e pronto.");
  
  isSdkReady = true;

  // Funções que só rodam UMA VEZ
  appendUserAvatar();
  appendChannelName();
  
  // Chame a fila uma vez imediatamente
  fetchBattleQueue(); 

}).catch((err) => {
    console.error("Erro fatal no setup do SDK:", err);
    // Esta mensagem de erro personalizada é ótima!
    document.querySelector('#app').innerHTML = `<p style="color:red; max-width: 400px;">Erro fatal no setup do SDK. Verifique o console (Ctrl+Shift+I).<br/><br/>Causas comuns:<br/>1. API (Servidor) está offline.<br/>2.<br/>3. Erro de CORS/CSP (Verifique as Configurações da Atividade no Discord).</p>`;
});


async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [ "identify", "guilds" ],
  });

  console.log("Código de autorização recebido:", code);

  // Busca o access_token do nosso backend (Render ou local)
  const response = await fetch(`${API_BASE_URL}/api/token`, { 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  console.log(`Resposta do ${API_BASE_URL}/api/token: ${response.status}`);
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Falha ao obter token:", errorBody);
    throw new Error(`Falha ao obter token: ${response.status}`);
  }

  const { access_token } = await response.json();

  // Autentica com o cliente Discord
  auth = await discordSdk.commands.authenticate({ access_token });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
  console.log("Autenticação com o SDK concluída.");
}

// Injeta o HTML base na página
document.querySelector('#app').innerHTML = `
  <div>
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h2 id="activity-channel"></h2>
    
    <h3>Ordem de Turno</h3>
    <div id="turn-order-list">
      <p>Carregando fila de batalha...</p>
    </div>
    <h3 id="channel-name"></h3>
  </div>
`;


async function appendChannelName() {
  const app = document.querySelector('#channel-name');
  if (app) app.innerHTML = '<p>Carregando nome do canal...</p>';
  
  let activityChannelName = 'Unknown';
  if (discordSdk.channelId && discordSdk.guildId) {
      try {
          const channel = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId });
          if (channel && channel.name) activityChannelName = channel.name;
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
  if (app) app.innerHTML = textTag.outerHTML;
}


async function appendUserAvatar() {
  const logoImg = document.querySelector('img.logo');
  if (!logoImg || !auth) { 
      console.warn("appendUserAvatar chamado sem autenticação ou sem <img>");
      return; 
  }
  const user = await fetch(`https://discord.com/api/v10/users/@me`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());

  let avatarUrl;
  if (user.avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`;
  } else {
    const defaultAvatarIndex = (user.discriminator || 0) % 5; 
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
  }
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
    const response = await fetch(`${API_BASE_URL}/api/get-battle-queue?channel=${channelId}`);
    if (!response.ok) throw new Error(`Erro do servidor: ${response.status} - ${await response.text()}`);

    const battleData = await response.json();
    console.log('Dados da fila recebidos:', battleData);

    // --- 🔧 Correção universal do formato ---
    let fila = [];

    // 1️⃣ Se já existir um array 'fila'
    if (Array.isArray(battleData.fila)) {
      fila = battleData.fila;
    }
    // 2️⃣ Se vier um objeto 'LutadoresMap' (ex: {"0": {...}, "1": {...}})
    else if (battleData.LutadoresMap && typeof battleData.LutadoresMap === 'object') {
      fila = Object.values(battleData.LutadoresMap);
    }
    // 3️⃣ Se vier um único objeto
    else if (battleData && typeof battleData === 'object') {
      console.warn("Estrutura inesperada, tentando adaptar:", battleData);
      fila = Object.values(battleData);
    }

    if (!Array.isArray(fila)) fila = [];

    const jogadorAtual = battleData.jogadorAtual;

    // Reordena se o jogadorAtual existir
    if (jogadorAtual) {
      const idx = fila.findIndex(j => j.nome === jogadorAtual);
      if (idx !== -1) {
        const [prioritario] = fila.splice(idx, 1);
        prioritario.step = 9999;
        fila.unshift(prioritario);
      }
    }

    const ativos = fila.filter(p => p?.ativo);
    ativos.sort((a, b) => b.step - a.step);

    if (ativos.length > 0) {
      const [prioritario] = ativos;
      const primeiroItemHtml = `<li><strong class="prioritario">${prioritario.nome}</strong> • ${prioritario.step}</li>`;
      const restante = ativos.slice(1).map(p => `<li><strong>${p.nome}</strong> • ${p.step}</li>`).join('');
      turnOrderContainer.innerHTML = `<ol>${primeiroItemHtml}${restante}</ol>`;
    } else {
      turnOrderContainer.innerHTML = "<p>Nenhum lutador ativo na fila.</p>";
    }
  } catch (error) {
    console.error("Falha ao buscar fila de batalha:", error);
    if (turnOrderContainer) turnOrderContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
  }
}


// --- LOOP DE ATUALIZAÇÃO (POLLING) ---
setInterval(() => {
  if (isSdkReady) {
    fetchBattleQueue();
  }
}, 2000); // 2000ms = 2 segundos.

