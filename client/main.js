// --- CONFIGURAÇÃO BASE ---
let API_BASE_URL = '';
console.log(`[INIT] Modo de ${import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}. API Base: ${API_BASE_URL || 'Relativa (mesmo domínio)'}`);

import rocketLogo from '/rocket.png';
import "./style.css";

// --- VARIÁVEIS GLOBAIS ---
let auth;
let isSdkReady = false;
let discordSdk = null;
let DiscordSDK = null;

// --- IMPORTA SDK SOMENTE EM PRODUÇÃO (DENTRO DO DISCORD) ---
if (!import.meta.env.DEV) {
  const sdkModule = await import("@discord/embedded-app-sdk");
  DiscordSDK = sdkModule.DiscordSDK;
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  console.log('Cliente ID do Discord (VITE):', import.meta.env.VITE_DISCORD_CLIENT_ID);
}

// =================================================================
// ⭐️ CORREÇÃO: MOVIDO PARA CIMA ⭐️
// Injetamos o HTML base e o CSS imediatamente.
// Isso garante que os elementos como '#turn-order-list' existam
// ANTES que qualquer função (como fetchBattleQueue) tente usá-los.
// =================================================================
document.querySelector('#app').innerHTML = `
<div>
 <img src="${rocketLogo}" class="logo" alt="Discord" />
 <h2 id="activity-channel"></h2>
 
 <h3>Ordem de Turno</h3>
 <div id="turn-order-list">
<p>Carregando...</p>
 </div>
 <h3 id="channel-name"></h3>
</div>
`;

// Adiciona o CSS para as setas
const styleSheet = document.createElement("style");
styleSheet.innerText = `
 .turn-list { list-style-type: none; padding-left: 5px; font-size: 1.1em; }
 .turn-list li { margin-bottom: 5px; }
 .prioritario { font-weight: bold; color: white; }
`;
document.head.appendChild(styleSheet);
// --- FIM DA SEÇÃO MOVIDA ---


// --- INICIALIZAÇÃO ---
// Agora que o HTML existe, podemos chamar as funções com segurança.
if (import.meta.env.DEV) {
  // --- MODO NAVEGADOR (DESENVOLVIMENTO) ---
  console.log("🧩 Modo Desenvolvimento: pulando autenticação Discord SDK.");
  isSdkReady = true; // Dizemos que "está pronto" para o loop de polling
  fetchBattleQueue(); // Busca a fila imediatamente
  mockDevelopmentMode(); // Apenas simula o avatar e o nome do canal
} else {
  // --- MODO DISCORD (PRODUÇÃO) ---
  setupDiscordSdk().then(() => {
    console.log("Discord SDK está autenticado e pronto.");
    isSdkReady = true;
    appendUserAvatar();
    appendChannelName();
    fetchBattleQueue(); // Busca a fila imediatamente
  }).catch((err) => {
    console.error("Erro fatal no setup do SDK:", err);
    // Esta parte agora funciona, pois '#app' já existe.
    document.querySelector('#app').innerHTML = `
<p style="color:red; max-width: 400px;">
Erro fatal no setup do SDK.<br/>Verifique o console (Ctrl+Shift+I).
</p>`;
  });
}


// --- FUNÇÕES DE PRODUÇÃO (SÓ RODAM NO DISCORD) ---
async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  console.log("Código de autorização recebido:", code);

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
  auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) throw new Error("Authenticate command failed");
  console.log("Autenticação com o SDK concluída.");
}

async function appendChannelName() {
  const app = document.querySelector('#channel-name');
  if (app) app.innerHTML = '<p>Carregando nome do canal...</p>';

  let activityChannelName = 'Unknown';
  if (discordSdk?.channelId && discordSdk?.guildId) {
    try {
      const channel = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId });
      if (channel?.name) activityChannelName = channel.name;
    } catch (error) {
      console.error("Erro RPC. Falha ao obter o canal.", error);
      activityChannelName = "Canal da Atividade (RPC Falhou)";
    }
  } else {
    activityChannelName = "Fora de Contexto de Atividade";
  }

  const textTag = document.createElement('p');
  textTag.textContent = `Canal: "${activityChannelName}"`;
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
  }).then((r) => r.json());

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

// --- FUNÇÃO UNIVERSAL (RODA EM AMBOS OS MODOS) ---
async function fetchBattleQueue() {
  console.log("Buscando fila de batalha...");
  // Agora este seletor vai funcionar, pois o HTML foi injetado primeiro.
  const turnOrderContainer = document.querySelector('#turn-order-list');

  let channelId;
  if (import.meta.env.DEV) {
    channelId = new URLSearchParams(window.location.search).get('channel_id');
  } else {
    channelId = 12345;
  }

  if (!channelId) {
    const helpText = import.meta.env.DEV
      ? `<p style="color:#faa;">ID do Canal não fornecido.<br/>Adicione <strong>?channel_id=12345...</strong> ao seu URL para testar.</p>`
      : "<p>ID do Canal não encontrado (Erro do SDK).</p>";

    // Esta linha agora é segura
    if (turnOrderContainer) turnOrderContainer.innerHTML = helpText;
    return;
  }

  try {
  
    const response = await fetch(`${API_BASE_URL}/api/get-battle-queue?channel=${channelId}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erro do Servidor:", errorData);
      throw new Error(`Erro do servidor: ${response.status}`);
    }

    const battleData = await response.json();
    let filaObjeto = battleData.fila;
    if (!filaObjeto || typeof filaObjeto !== 'object') filaObjeto = {};

    let fila = Object.values(filaObjeto);
    const jogadorAtual = battleData.jogadorAtual;

    if (jogadorAtual) {
      const idx = fila.findIndex(j => j.nome === jogadorAtual);
      if (idx !== -1) {
        const [jogadorPrioritario] = fila.splice(idx, 1);
        jogadorPrioritario.step = 9999;
        fila.unshift(jogadorPrioritario);
      }
    }

    const ativos = fila.filter(p => p.ativo).sort((a, b) => b.step - a.step);
    if (ativos.length > 0) {
      const atual = ativos.shift();
      const htmlList = `
    <ul class="turn-list">
     <li class="prioritario">➡️ [${atual.battlerId}] <strong>${atual.nome}</strong></li>
     ${ativos.map(p => `<li>&rarr; [${p.battlerId}] ${p.nome}</li>`).join('')}
    </ul>`;
      // Esta linha agora é segura
      if (turnOrderContainer) turnOrderContainer.innerHTML = htmlList;
    } else {
      // Esta linha agora é segura
      if (turnOrderContainer) turnOrderContainer.innerHTML = "<p>Nenhum lutador ativo na fila.</p>";
    }
  } catch (error) {
    console.error("Falha ao buscar fila:", error);
    // Esta linha agora é segura
    if (turnOrderContainer) {
      turnOrderContainer.innerHTML = `<p style="color:red;">Falha ao buscar dados.<br/>${error.message}</p>`;
    }
  }
}

// --- MODO DESENVOLVIMENTO (CORRIGIDO) ---
function mockDevelopmentMode() {
  isSdkReady = true;
  console.log("Simulando ambiente local (avatar e nome do canal).");

  // Simula o avatar
  const logoImg = document.querySelector('img.logo');
  if (logoImg) {
    logoImg.src = "https://i.sstatic.net/EYX0L.png";
    logoImg.alt = "Avatar do Servidor";
    logoImg.width = 108;
    logoImg.height = 500;
    logoImg.style.borderRadius = "70%";
  }

  // Simula o nome do canal
  const channelElement = document.querySelector('#channel-name');
  if (channelElement) channelElement.innerHTML = `<p>Canal: "ambiente-dev"</p>`;
}

// --- LOOP DE ATUALIZAÇÃO (UNIVERSAL) ---
setInterval(() => {
  if (isSdkReady) fetchBattleQueue();
}, 2000);