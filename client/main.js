// --- CONFIGURAÇÃO BASE ---
let API_BASE_URL = '';
console.log(`[INIT] Modo de ${import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}.`);

import "./style.css"; 

// --- VARIÁVEIS GLOBAIS ---
let auth;
let isSdkReady = false;
let discordSdk = null;
let DiscordSDK = null;

// --- VARIÁVEIS DE NAVEGAÇÃO ---
let appElement; // Onde o conteúdo da página é renderizado
let batalhaPageHTML; // Armazena o HTML original da página de batalha

// --- IMPORTA SDK (REMOVIDO DAQUI) ---
// O bloco "if (!import.meta.env.DEV)" que estava aqui foi movido
// para dentro da "setupDiscordSdk" para evitar o "top-level await".


// --- INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  appElement = document.querySelector('#app');
  batalhaPageHTML = appElement.innerHTML; 

  setupNavigation();

  if (import.meta.env.DEV) {
    console.log("🧩 Modo Desenvolvimento: pulando autenticação Discord SDK.");
    isSdkReady = true; 
    fetchBattleQueue(); 
    mockDevelopmentMode();
  } else {
    // --- MODO DISCORD (PRODUÇÃO) ---
    setupDiscordSdk().then(() => { // Esta função agora também fará a importação
      console.log("Discord SDK está autenticado e pronto.");
      isSdkReady = true; 
      appendUserAvatar();
      appendChannelName();
      fetchBattleQueue();
    }).catch((err) => {
      console.error("Erro fatal no setup do SDK:", err);
      appElement.innerHTML = `
        <p style="color:red; max-width: 400px; padding: 2rem;">
          Erro fatal no setup do SDK.<br/>Verifique o console (Ctrl+Shift+I).
        </p>`;
    });
  }
}


// --- LÓGICA DE NAVEGAÇÃO (ROTEAMENTO) ---
// (Esta seção permanece IDÊNTICA - Nenhuma mudança aqui)

function setupNavigation() {
  const navBatalha = document.querySelector('#nav-batalha');
  const navFicha = document.querySelector('#nav-ficha');
  const navStatus = document.querySelector('#nav-status');

  navBatalha.addEventListener('click', (e) => {
    e.preventDefault();
    renderPage('batalha');
    updateNavActive(navBatalha);
  });

  navFicha.addEventListener('click', (e) => {
    e.preventDefault();
    renderPage('ficha');
    updateNavActive(navFicha);
  });

  navStatus.addEventListener('click', (e) => {
    e.preventDefault();
    renderPage('status');
    updateNavActive(navStatus);
  });
}

function updateNavActive(activeButton) {
  document.querySelectorAll('.navbar a').forEach(btn => {
    btn.classList.remove('active');
  });
  activeButton.classList.add('active');
}

function renderPage(pageName) {
  isSdkReady = (pageName === 'batalha');

  switch (pageName) {
    case 'batalha':
      appElement.innerHTML = batalhaPageHTML;
      fetchBattleQueue(); 
      
      if (import.meta.env.DEV) {
        mockDevelopmentMode(); 
      } else if (auth) {
        appendUserAvatar();
        appendChannelName();
      }
      break;

    case 'ficha':
      appElement.innerHTML = getFichaPageHTML();
      if (!import.meta.env.DEV) {
         fetchParticipantData();
      }
      break;

    case 'status':
      appElement.innerHTML = getStatusPageHTML();
      break;

    default:
      appElement.innerHTML = batalhaPageHTML;
  }
}

// --- GERADORES DE CONTEÚDO DE PÁGINA ---
// (Esta seção permanece IDÊNTICA - Nenhuma mudança aqui)

function getFichaPageHTML() {
  const commonStyles = 'padding: 2rem; text-align: center;';

  if (import.meta.env.DEV) {
    return `
      <div style="${commonStyles}">
        <h3>Ficha do Personagem (DEV)</h3>
        <p>Em modo de desenvolvimento, os dados da ficha não são carregados.</p>
        <p>Abra esta atividade no Discord para ver as fichas dos participantes.</p>
      </div>
    `;
  } else {
    return `
      <div style="${commonStyles}" id="ficha-container">
        <h3>Fichas dos Personagens</h3>
        <p>Carregando dados dos participantes no canal...</p>
      </div>
    `;
  }
}

function getStatusPageHTML() {
  return `
    <div style="padding: 2rem; text-align: center;">
      <h3>Status do Time</h3>
      <p>Em breve...</p>
    </div>
  `;
}

// --- FUNÇÕES DE BUSCA DE DADOS (DATA FETCHING) ---
// (Esta seção permanece IDÊNTICA - Nenhuma mudança aqui)

async function fetchParticipantData() {
    const container = document.querySelector('#ficha-container');
    if (!discordSdk || !discordSdk.channelId) {
        if (container) container.innerHTML += '<p style="color: red;">SDK do Discord não está pronto ou ID do canal é inválido.</p>';
        return;
    }
    
    try {
        const { participants } = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId });
        
        if (!participants || participants.length === 0) {
            container.innerHTML = '<h3>Fichas</h3><p>Nenhum participante encontrado no canal.</p>';
            return;
        }
        
        let html = '<h3>Participantes no Canal</h3>';
        html += '<ul style="list-style: none; padding: 0; text-align: left;">';
        
        participants.forEach(user => {
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
                : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;

            html += `
                <li style="display: flex; align-items: center; margin-bottom: 10px; background: #333; padding: 10px; border-radius: 8px;">
                    <img src="${avatarUrl}" alt="${user.username}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
                    <span style="font-weight: bold;">${user.global_name || user.username}</span>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao buscar participantes:", err);
        if (container) container.innerHTML = '<h3>Fichas</h3><p style="color: red;">Falha ao carregar dados dos participantes.</p>';
    }
}


// --- FUNÇÕES DE PRODUÇÃO (SDK DO DISCORD) ---

async function setupDiscordSdk() {
  
  // ⭐️⭐️⭐️ CORREÇÃO AQUI ⭐️⭐️⭐️
  // Movemos a importação para DENTRO da função 'async'
  // Isso elimina o "top-level await".
  const sdkModule = await import("@discord/embedded-app-sdk");
  DiscordSDK = sdkModule.DiscordSDK;
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  console.log('Cliente ID do Discord (VITE):', import.meta.env.VITE_DISCORD_CLIENT_ID);
  // ⭐️⭐️⭐️ FIM DA CORREÇÃO ⭐️⭐️⭐️

  await discordSdk.ready();
  console.log("Discord SDK is ready");

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds", "rpc.voice.read"], 
  });

  console.log("Código de autorização recebido:", code);

  const response = await fetch(`${API_BASE_URL}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

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

// --- O RESTANTE DO ARQUIVO PERMANECE IDÊNTICO ---
// (appendChannelName, appendUserAvatar, fetchBattleQueue, 
//  mockDevelopmentMode, setInterval)

async function appendChannelName() {
  const app = document.querySelector('#channel-name');
  if (!app) return; 
  
  app.innerHTML = '<p>Carregando nome do canal...</p>';

  let activityChannelName = 'Unknown';
  if (discordSdk?.channelId && discordSdk?.guildId) {
    try {
      const channel = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId });
      if (channel?.name) activityChannelName = channel.name;
    } catch (error) {
      console.error("Erro RPC. Falha ao obter o canal.", error);
    }
  }
  app.textContent = `Canal: "${activityChannelName}"`;
}

async function appendUserAvatar() {
  const logoImg = document.querySelector('img.logo');
  if (!logoImg || !auth) return;

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

async function fetchBattleQueue() {
  console.log("Buscando fila de batalha...");
  const turnOrderContainer = document.querySelector('#turn-order-list');
  if (!turnOrderContainer) return; 

  let channelId;
  if (import.meta.env.DEV) {
    channelId = new URLSearchParams(window.location.search).get('channel_id');
  } else {
    channelId = discordSdk?.channelId;
  }

  if (!channelId) {
    const helpText = import.meta.env.DEV
      ? `<p style="color:#faa;">ID do Canal não fornecido.<br/>Adicione <strong>?channel_id=12345...</strong> ao seu URL para testar.</p>`
      : "<p>ID do Canal não encontrado (Erro do SDK).</p>";
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
      if (turnOrderContainer) turnOrderContainer.innerHTML = htmlList;
    } else {
      if (turnOrderContainer) turnOrderContainer.innerHTML = "<p>Nenhum lutador ativo na fila.</p>";
    }
  } catch (error) {
    console.error("Falha ao buscar fila:", error);
    if (turnOrderContainer) {
      turnOrderContainer.innerHTML = `<p style="color:red;">Falha ao buscar dados.<br/>${error.message}</p>`;
    }
  }
}

function mockDevelopmentMode() {
  const logoImg = document.querySelector('img.logo');
  if (logoImg) {
    logoImg.src = "https://cdn.discordapp.com/icons/1130587651414696056/a_25e3f65c9a7d63c5f76c7b2e54a09953.webp?size=128";
    logoImg.alt = "Avatar do Servidor";
    logoImg.width = 128;
    logoImg.height = 128;
    logoImg.style.borderRadius = "50%";
  }

  const channelElement = document.querySelector('#channel-name');
  if (channelElement) channelElement.innerHTML = `<p>Canal: "ambiente-dev"</p>`;
}

setInterval(() => {
  if (isSdkReady) fetchBattleQueue();
}, 2000);