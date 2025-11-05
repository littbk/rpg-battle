// --- CONFIGURAÇÃO BASE ---
let API_BASE_URL = '';
console.log(`[INIT] Modo de ${import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}.`);

import "./style.css"; 

// --- VARIÁVEIS GLOBAIS ---
let auth;
let isSdkReady = false;
let discordSdk = null;
let DiscordSDK = null;
let currentChannelId = null; // Armazena o ID do canal de VOZ atual

// ⭐️ NOVO: ID do canal de CHAT fixo ⭐️
const RPG_CHAT_CHANNEL_ID = '1420530344884572271';

// --- VARIÁVEIS DE NAVEGAÇÃO ---
let appElement;
let batalhaPageHTML; 

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', initializeApp);

/**
 * Função principal que inicia a aplicação.
 */
function initializeApp() {
  appElement = document.querySelector('#app');
  // Armazena o HTML inicial da página de batalha para restauração
  batalhaPageHTML = appElement.innerHTML; 

  setupNavigation();

  const urlParams = new URLSearchParams(window.location.search);

  if (import.meta.env.DEV) {
    // --- MODO NAVEGADOR (DESENVOLVIMENTO) ---
    console.log("🧩 Modo Desenvolvimento: pulando autenticação Discord SDK.");
    isSdkReady = true; 
    fetchBattleQueue(); 
    mockDevelopmentMode();
    initializeChat(); // Inicia o chat em modo 'mock'
  
  } else if (urlParams.has('frame_id')) {
    // --- MODO DISCORD (PRODUÇÃO, DENTRO DO DISCORD) ---
    setupDiscordSdk().then(() => {
      console.log("Discord SDK está autenticado e pronto.");
      isSdkReady = true; 
      
      currentChannelId = discordSdk.channelId; 
      if (!currentChannelId) {
        console.error("ERRO CRÍTICO: discordSdk.channelId é nulo. Verifique os scopes ('guilds').");
        appElement.innerHTML = `<p style="color:red; padding: 2rem;">Erro: Não foi possível obter o ID do canal de voz. Tente reiniciar a atividade.</p>`;
        return;
      }
      
      console.log("ID do Canal de Voz obtido:", currentChannelId);
      
      // Carrega os dados da página de Batalha
      appendUserAvatar();
      appendChannelName();
      fetchBattleQueue();
      initializeChat(); // Inicia o chat (que vai TENTAR carregar)
    }).catch((err) => {
      console.error("Erro fatal no setup do SDK:", err);
      // Mostra o erro dentro do #app
      appElement.innerHTML = `
        <p style="color:red; max-width: 400px; padding: 2rem;">
          Erro fatal no setup do SDK.<br/>Verifique o console (Ctrl+Shift+I).
          <br/><br/>
          <small>${err.message}</small>
        </p>`;
    });

  } else {
    // --- MODO NAVEGADOR (PRODUÇÃO, FORA DO DISCORD) ---
    console.log("🧩 Modo Produção (Navegador): Carregando fora do Discord.");
    appElement.innerHTML = `
      <div style="padding: 2rem; text-align: center;">
        <h3>Atividade do Discord</h3>
        <p>Esta aplicação foi feita para ser executada como uma Atividade dentro do Discord.</p>
        <p>Por favor, abra esta atividade em um canal de voz no Discord para usá-la.</p>
      </div>
    `;
    // Esconde a navbar se estiver fora do Discord
    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.style.display = 'none';
  }
}


// --- LÓGICA DE NAVEGAÇÃO (ROTEAMENTO) ---

/**
 * Configura os event listeners para os botões da navbar.
 */
function setupNavigation() {
  const navBatalha = document.querySelector('#nav-batalha');
  const navFicha = document.querySelector('#nav-ficha');
  const navStatus = document.querySelector('#nav-status');

  navBatalha.addEventListener('click', (e) => {
    e.preventDefault(); // Impede que o link '#' recarregue a página
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

/**
 * Atualiza o estado 'active' na navbar.
 * @param {HTMLElement} activeButton - O botão que foi clicado.
 */
function updateNavActive(activeButton) {
  // Remove 'active' de todos os botões
  document.querySelectorAll('.navbar a').forEach(btn => {
    btn.classList.remove('active');
  });
  // Adiciona 'active' apenas ao botão clicado
  activeButton.classList.add('active');
}

/**
 * Renderiza o conteúdo da página selecionada dentro do #app
 * @param {'batalha' | 'ficha' | 'status'} pageName 
 */
function renderPage(pageName) {
  
  // PAUSA o polling da fila de batalha se não estivermos na página de batalha
  isSdkReady = (pageName === 'batalha');

  switch (pageName) {
    case 'batalha':
      // Restaura o HTML original da página de batalha
      appElement.innerHTML = batalhaPageHTML;
      
      // REINICIA o polling (isSdkReady foi setado para true)
      fetchBattleQueue(); // Busca os dados imediatamente
      
      // Re-popula os dados que não são do polling
      if (import.meta.env.DEV) {
        mockDevelopmentMode(); 
      } else if (auth) { // Se estiver autenticado em PROD
        appendUserAvatar();
        appendChannelName();
      }
      
      // Reinicia o chat
      initializeChat();
      break;

    case 'ficha':
      appElement.innerHTML = getFichaPageHTML();
      // Tenta buscar os dados dos participantes (VAI FALHAR por falta de scope)
      if (!import.meta.env.DEV) {
         fetchParticipantData();
      }
      break;

    case 'status':
      appElement.innerHTML = getStatusPageHTML();
      break;

    default:
      // Padrão é a página de batalha
      appElement.innerHTML = batalhaPageHTML;
  }
}

// --- GERADORES DE CONTEÚDO DE PÁGINA ---

/**
 * Gera o HTML para a página 'Ficha'.
 * @returns {string} O HTML da página.
 */
function getFichaPageHTML() {
  const commonStyles = 'padding: 2rem; text-align: center;';

  if (import.meta.env.DEV) {
    // Modo DEV: Placeholder
    return `
      <div style="${commonStyles}">
        <h3>Ficha do Personagem (DEV)</h3>
        <p>Em modo de desenvolvimento, os dados da ficha não são carregados.</p>
        <p>Abra esta atividade no Discord para ver as fichas dos participantes.</p>
      </div>
    `;
  } else {
    // Modo PROD: Placeholder enquanto carrega
    return `
      <div style="${commonStyles}" id="ficha-container">
        <h3>Fichas dos Personagens</h3>
        <p>Carregando dados dos participantes no canal...</p>
      </div>
    `;
  }
}

/**
 * Gera o HTML para a página 'Status'.
 * @returns {string} O HTML da página.
 */
function getStatusPageHTML() {
  return `
    <div style="padding: 2rem; text-align: center;">
      <h3>Status do Time</h3>
      <p>Em breve...</p>
    </div>
  `;
}

// --- FUNÇÕES DE BUSCA DE DADOS (DATA FETCHING) ---

/**
 * Busca e exibe os participantes do canal de voz.
 * (Esta função vai falhar em PROD por falta de scope, e mostrará um erro).
 */
async function fetchParticipantData() {
    const container = document.querySelector('#ficha-container');
    if (!discordSdk || !currentChannelId) {
        if (container) container.innerHTML += '<p style="color: red;">SDK do Discord não está pronto ou ID do canal de voz é inválido.</p>';
        return;
    }
    
    try {
        // Esta chamada VAI FALHAR, o que é esperado
        const { participants } = await discordSdk.commands.getChannel({ channel_id: currentChannelId }); 
        
        if (!participants || participants.length === 0) {
            container.innerHTML = '<h3>Fichas</h3><p>Nenhum participante encontrado no canal de voz.</p>';
            return;
        }
        
        let html = '<h3>Participantes no Canal</h3>';
        html += '<ul style="list-style: none; padding: 0; text-align: left;">';
        
        // Renderiza a lista de participantes
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
        // Mostra uma mensagem de erro clara
        console.error("Erro ao buscar participantes:", err);
        if (container) container.innerHTML = '<h3>Fichas</h3><p style="color: red;">Falha ao carregar. (O App não tem a permissão `rpc.voice.read`)</p>';
    }
}


// --- FUNÇÕES DO CHAT ---

/**
 * Inicializa o chatbox.
 * (Irá mostrar um erro em PROD por falta de scopes).
 */
function initializeChat() {
  const messagesList = document.querySelector('#chat-messages-list');
  const messageInput = document.querySelector('#chat-message-input');
  const sendButton = document.querySelector('#chat-send-btn');

  // Se os elementos do chat não existirem (ex: noutra página), sai
  if (!messagesList || !messageInput || !sendButton) {
    return;
  }

  // Define a mensagem de erro (diferente para DEV ou PROD)
  const chatErrorMsg = (import.meta.env.DEV)
    ? "O chat só funciona quando a atividade é aberta pelo Discord."
    : "O chat está desabilitado. (O App não tem as permissões `rpc.messages.*`)";

  // Mostra o erro e desabilita o chat.
  messagesList.innerHTML = `
    <div class="chat-message system">
      <span class="chat-message-content" style="color: #f88;">${chatErrorMsg}</span>
    </div>`;
  messageInput.value = "Chat desabilitado";
  messageInput.disabled = true;
  sendButton.disabled = true;
}

/**
 * Busca as 7 últimas mensagens do canal de CHAT FIXO.
 * (Esta função não será chamada, pois o chat é desabilitado acima).
 */
async function fetchChannelMessages(messagesList) {
  if (!discordSdk || !RPG_CHAT_CHANNEL_ID || !auth) {
    console.warn("SDK, ID do Canal de Chat ou Auth não estão prontos para buscar mensagens.");
    return;
  }
  
  try {
    const { messages } = await discordSdk.commands.getChannelMessages({
      channel_id: RPG_CHAT_CHANNEL_ID,
      limit: 7,
    });
    
    messagesList.innerHTML = '';
    messages.reverse().forEach(message => renderMessage(message, messagesList));
    
  } catch (err) {
    // Isto VAI FALHAR se o app não tiver o scope 'rpc.messages.read'
    console.error("Erro ao buscar histórico de mensagens:", err);
    messagesList.innerHTML = `
      <div class="chat-message system">
        <span class="chat-message-content" style="color: #f88;">Falha ao carregar histórico. (App requer scope 'rpc.messages.read')</span>
      </div>`;
  }
}

/**
 * Subscreve a novas mensagens do canal de CHAT FIXO.
 * (Esta função não será chamada).
 */
async function subscribeToChannelMessages(messagesList) {
  if (!discordSdk) return;
  try {
    await discordSdk.commands.subscribe('MESSAGE_CREATE', (evt) => {
      const message = evt.data.message;
      if (message.channel_id === RPG_CHAT_CHANNEL_ID) {
        renderMessage(message, messagesList);
      }
    }, { channel_id: RPG_CHAT_CHANNEL_ID });

    console.log("Inscrito para novas mensagens no canal:", RPG_CHAT_CHANNEL_ID);
  } catch(err) {
    console.error("Falha ao se inscrever nas mensagens:", err);
    messagesList.innerHTML += `
      <div class="chat-message system">
        <span class="chat-message-content" style="color: #f88;">Falha ao subscrever. (App requer scope 'rpc.messages.subscribe')</span>
      </div>`;
  }
}

/**
 * Configura o input para enviar mensagens para o canal de CHAT FIXO.
 * (Esta função não será chamada).
 */
function setupChatInput(messageInput, sendButton) {
  const sendMessage = async () => {
    const content = messageInput.value;
    if (content.trim() === "" || !discordSdk) return;

    try {
      messageInput.disabled = true;
      sendButton.disabled = true;

      await discordSdk.commands.sendChannelMessage({
        channel_id: RPG_CHAT_CHANNEL_ID,
        content: content,
      });
      
      messageInput.value = "";

    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
       messagesList.innerHTML += `
      <div class="chat-message system">
        <span class="chat-message-content" style="color: #f88;">Falha ao enviar. (App requer scope 'rpc.messages.send')</span>
      </div>`;
    } finally {
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    }
  };

  sendButton.onclick = sendMessage; 

  messageInput.onkeydown = (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
}

/**
 * Renderiza uma única mensagem no chatbox.
 */
function renderMessage(message, messagesList) {
  if (!auth) { 
    console.warn("Auth não está pronto, não é possível renderizar a mensagem.");
    return;
  }

  const messageEl = document.createElement('div');
  
  const messageType = (message.author.id === auth.user.id) ? 'user-message' : 'other-message';
  
  messageEl.classList.add('chat-message', messageType);

  let authorHTML = '';
  if (messageType === 'other-message') {
    authorHTML = `<span class="chat-message-author">${message.author.global_name || message.author.username}</span>`;
  }
  
  const safeContent = message.content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  messageEl.innerHTML = `
    ${authorHTML}
    <span class="chat-message-content">${safeContent}</span>
  `;
  
  messagesList.appendChild(messageEl);
  
  messagesList.scrollTop = messagesList.scrollHeight;
}


// --- FUNÇÕES DE PRODUÇÃO (SDK DO DISCORD) ---

/**
 * Configura o SDK do Discord, autentica e obtém o token.
 */
async function setupDiscordSdk() {
  
  // Carrega o SDK
  const sdkModule = await import("@discord/embedded-app-sdk");
  DiscordSDK = sdkModule.DiscordSDK;
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  console.log('Cliente ID do Discord (VITE):', import.meta.env.VITE_DISCORD_CLIENT_ID);
  
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // ⭐️⭐️⭐️ A CORREÇÃO ESTÁ AQUI ⭐️⭐️⭐️
  // Removemos TODOS os scopes que estão a falhar ('rpc.voice.read', 'rpc.messages.*').
  // Pedimos apenas o básico para a app carregar e a "Ordem de Turno" funcionar.
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify", 
      "guilds"
      // "rpc.voice.read",       // <-- REMOVIDO (Não está na sua lista)
      // "rpc.messages.read",       // <-- REMOVIDO (Não está na sua lista)
      // "rpc.messages.subscribe",  // <-- REMOVIDO (Não está na sua lista)
      // "rpc.messages.send"        // <-- REMOVIDO (Não está na sua lista)
    ], 
  });

  console.log("Código de autorização recebido:", code);

  // Troca o código por um token de acesso
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

  // Autentica com o SDK
  const { access_token } = await response.json();
  auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) throw new Error("Authenticate command failed");
  console.log("Autenticação com o SDK concluída.");
}

// --- Funções de Batalha e Mock (sem mudanças) ---

/**
 * Exibe o nome do canal de voz atual.
 */
async function appendChannelName() {
  const app = document.querySelector('#channel-name');
  if (!app) return; // Não tenta atualizar se o elemento não existir
  
  let activityChannelName = 'Unknown';
  
  // O 'currentChannelId' é o do canal de VOZ
  if (currentChannelId && discordSdk?.guildId) { 
    try {
      // Esta chamada pode falhar se 'guilds' não for suficiente
      const channel = await discordSdk.commands.getChannel({ channel_id: currentChannelId });
      if (channel?.name) activityChannelName = channel.name;
    } catch (error) {
      console.error("Erro RPC. Falha ao obter o canal.", error);
      activityChannelName = "Canal de Voz"; // Fallback
    }
  }
  app.textContent = `Canal: "${activityChannelName}"`;
}

/**
 * Exibe o avatar do usuário autenticado.
 */
async function appendUserAvatar() {
  const logoImg = document.querySelector('img.logo');
  if (!logoImg || !auth) return; // Não tenta atualizar se não houver <img> ou auth

  const user = auth.user; 

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

/**
 * Busca a fila de batalha da nossa API e a exibe.
 */
async function fetchBattleQueue() {
  console.log("Buscando fila de batalha...");
  const turnOrderContainer = document.querySelector('#turn-order-list');
  if (!turnOrderContainer) return; // Para se não estiver na página de Batalha

  let channelId;
  if (import.meta.env.DEV) {
    channelId = new URLSearchParams(window.location.search).get('channel_id');
  } else {
    channelId = currentChannelId; // Usa a var global (canal de VOZ)
  }

  if (!channelId) {
    const helpText = import.meta.env.DEV
      ? `<p style="color:#faa;">ID do Canal não fornecido.<br/>Adicione <strong>?channel_id=12345...</strong> ao seu URL para testar.</p>`
      : "<p style='color:red;'>ID do Canal de Voz não encontrado.</p>";
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

/**
 * Simula dados do avatar e do canal para o modo DEV.
 */
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

// --- LOOP DE ATUALIZAÇÃO ---
setInterval(() => {
  if (isSdkReady) fetchBattleQueue();
}, 2000);