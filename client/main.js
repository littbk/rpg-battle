// --- CONFIGURAÇÃO BASE ---
let API_BASE_URL = '';
console.log(`[INIT] Modo de ${import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}.`);

import "./style.css"; 

// --- VARIÁVEIS GLOBAIS ---
let auth;
let isSdkReady = false;
let discordSdk = null;
let DiscordSDK = null;
const mainChannelId = '1420530344884572271'
let currentChannelId = ''

// --- VARIÁVEIS DE NAVEGAÇÃO ---
let appElement;
let batalhaPageHTML; 

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  appElement = document.querySelector('#app');
  // Salva o HTML da página 'Batalha'
  // É importante que o seletor seja específico para o conteúdo
  batalhaPageHTML = document.querySelector('#app').innerHTML; 

  setupNavigation();

  const urlParams = new URLSearchParams(window.location.search);

  if (import.meta.env.DEV) {
    // --- MODO NAVEGADOR (DESENVOLVIMENTO) ---
    console.log("🧩 Modo Desenvolvimento: pulando autenticação Discord SDK.");
    isSdkReady = true; 
    fetchBattleQueue(); 
    mockDevelopmentMode();
    initializeChat(); // ⭐️ NOVO: Inicia o chat em modo 'mock'
  
  } else if (urlParams.has('frame_id')) {
    // --- MODO DISCORD (PRODUÇÃO, DENTRO DO DISCORD) ---
    setupDiscordSdk().then(() => {
      console.log("Discord SDK está autenticado e pronto.");
      isSdkReady = true; 
      //currentChannelId = discordSdk.channelId; // ⭐️ NOVO: Salva o ID do canal
      
      // Carrega os dados da página de Batalha
      appendUserAvatar();
      appendChannelName();
      fetchBattleQueue();
      initializeChat(); // ⭐️ NOVO: Inicia o chat real
    }).catch((err) => {
      console.error("Erro fatal no setup do SDK:", err);
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
    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.style.display = 'none';
  }
}


// --- LÓGICA DE NAVEGAÇÃO (ROTEAMENTO) ---

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
      
      // ⭐️ NOVO: Reinicia o chat na página de Batalha
      initializeChat();
      break;

    case 'ficha':
      appElement.innerHTML = getFichaPageHTML();
      // Se estiver em produção, busca os dados dos participantes
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

function getStatusPageHTML() {
  return `
    <div style="padding: 2rem; text-align: center;">
      <h3>Status do Time</h3>
      <p>Em breve...</p>
    </div>
  `;
}

// --- FUNÇÕES DE BUSCA DE DADOS (DATA FETCHING) ---

// Esta função busca os participantes do canal de voz (Modo PROD)
async function fetchParticipantData() {
    const container = document.querySelector('#ficha-container');
    if (!discordSdk || !currentChannelId) {
        if (container) container.innerHTML += '<p style="color: red;">SDK do Discord não está pronto ou ID do canal é inválido.</p>';
        return;
    }
    
    try {
        // Busca os usuários no canal de voz atual
        const { participants } = await discordSdk.commands.getChannel({ channel_id: currentChannelId }); // Usa a var global
        
        if (!participants || participants.length === 0) {
            container.innerHTML = '<h3>Fichas</h3><p>Nenhum participante encontrado no canal.</p>';
            return;
        }

        // Por enquanto, apenas listamos os participantes.
        // No futuro, você pode fazer uma chamada à sua API /api/get-ficha?userId=...
        
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


// --- ⭐️ NOVAS FUNÇÕES DO CHAT ⭐️ ---

function initializeChat() {
  const messagesList = document.querySelector('#chat-messages-list');
  const messageInput = document.querySelector('#chat-message-input');
  const sendButton = document.querySelector('#chat-send-btn');

  if (!messagesList || !messageInput || !sendButton) {
    // Isso é normal se estivermos em outra página que não seja 'batalha'
    // console.log("Elementos do chat não encontrados (provavelmente em outra página).");
    return;
  }

  if (import.meta.env.DEV) {
    // --- MODO DEV: Simula um chat desabilitado ---
    messagesList.innerHTML = `
      <div class="chat-message system">
        <span class="chat-message-content">O chat só funciona quando a atividade é aberta pelo Discord.</span>
      </div>`;
    messageInput.value = "Chat desabilitado no modo DEV";
    messageInput.disabled = true;
    sendButton.disabled = true;
  } else {
    // --- MODO PROD: Ativa o chat real ---
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.value = "";
    messageInput.placeholder = "Digite sua mensagem...";

    fetchChannelMessages(messagesList);
    subscribeToChannelMessages(messagesList);
    setupChatInput(messageInput, sendButton);
  }
}

async function fetchChannelMessages(messagesList) {
  if (!discordSdk || !mainChannelId || !auth) {
    console.warn("SDK, ChannelID ou Auth não estão prontos para buscar mensagens.");
    return;
  }
  
  try {
    // Busca as 7 últimas mensagens
    const { messages } = await discordSdk.commands.getChannelMessages({
      channel_id: mainChannelId,
      limit: 7,
    });
    
    // Limpa a mensagem "Carregando..."
    messagesList.innerHTML = '';
    
    // Renderiza as mensagens (em ordem reversa, da mais antiga para a mais nova)
    messages.reverse().forEach(message => renderMessage(message, messagesList));
    
  } catch (err) {
    console.error("Erro ao buscar histórico de mensagens:", err);
    messagesList.innerHTML = `
      <div class="chat-message system">
        <span class="chat-message-content" style="color: #f88;">Falha ao carregar histórico: ${err.message}</span>
      </div>`;
  }
}

async function subscribeToChannelMessages(messagesList) {
  if (!discordSdk) return;

  // Cancela inscrições antigas (se houver)
  // Usar um handler vazio é uma forma de tentar limpar, mas o SDK pode exigir a referência original
  // Por segurança, vamos apenas nos inscrever. O SDK deve lidar com sobreposições.

  // Inscreve-se para novas mensagens APENAS no canal atual
  await discordSdk.commands.subscribe('MESSAGE_CREATE', (evt) => {
    const message = evt.data.message;
    // Só renderiza se a mensagem for do canal que estamos vendo
    if (message.channel_id === mainChannelId) {
      renderMessage(message, messagesList);
    }
  }, { channel_id: mainChannelId });

  console.log("Inscrito para novas mensagens no canal:", mainChannelId);
}

function setupChatInput(messageInput, sendButton) {
  // Função para enviar
  const sendMessage = async () => {
    const content = messageInput.value;
    if (content.trim() === "" || !discordSdk) return;

    try {
      // Desabilita o input enquanto envia
      messageInput.disabled = true;
      sendButton.disabled = true;

      await discordSdk.commands.sendChannelMessage({
        channel_id: mainChannelId,
        content: content,
      });
      
      // Limpa o input
      messageInput.value = "";

    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      // Opcional: mostrar um erro no chat
    } finally {
      // Re-habilita o input
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    }
  };

  // Envia ao clicar no botão
  sendButton.onclick = sendMessage; // Usa onclick para evitar múltiplos listeners

  // Envia ao pressionar "Enter"
  messageInput.onkeydown = (e) => { // Usa onkeydown para evitar múltiplos listeners
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
}

function renderMessage(message, messagesList) {
  if (!auth) { // Checagem de segurança
    console.warn("Auth não está pronto, não é possível renderizar a mensagem.");
    return;
  }

  const messageEl = document.createElement('div');
  
  // Verifica se a mensagem é do usuário logado ou de outro
  const messageType = (message.author.id === auth.user.id) ? 'user-message' : 'other-message';
  
  messageEl.classList.add('chat-message', messageType);

  // Adiciona o nome do autor (apenas para mensagens de 'outros')
  let authorHTML = '';
  if (messageType === 'other-message') {
    authorHTML = `<span class="chat-message-author">${message.author.global_name || message.author.username}</span>`;
  }
  
  // Simples sanitização para evitar injeção de HTML
  const safeContent = message.content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  messageEl.innerHTML = `
    ${authorHTML}
    <span class="chat-message-content">${safeContent}</span>
  `;
  
  messagesList.appendChild(messageEl);
  
  // Rola para o final
  messagesList.scrollTop = messagesList.scrollHeight;
}


// --- FUNÇÕES DE PRODUÇÃO (SDK DO DISCORD) ---

async function setupDiscordSdk() {
  
  // Carrega o SDK
  const sdkModule = await import("@discord/embedded-app-sdk");
  DiscordSDK = sdkModule.DiscordSDK;
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  console.log('Cliente ID do Discord (VITE):', import.meta.env.VITE_DISCORD_CLIENT_ID);
  
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Pede as novas permissões de chat
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify", 
      "guilds", 
      "rpc.voice.read",
    ], 
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

// --- Funções de Batalha e Mock (sem mudanças) ---

async function appendChannelName() {
  const app = document.querySelector('#channel-name');
  if (!app) return; 
  
  app.innerHTML = '<p>Carregando nome do canal...</p>';

  let activityChannelName = 'Unknown';
  if (currentChannelId && discordSdk?.guildId) { // Usa a var global
    try {
      const channel = await discordSdk.commands.getChannel({ channel_id: currentChannelId });
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

  // 'auth' já tem os dados do usuário, não precisamos de outro fetch
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

async function fetchBattleQueue() {
  console.log("Buscando fila de batalha...");
  const turnOrderContainer = document.querySelector('#turn-order-list');
  if (!turnOrderContainer) return; 

  let channelId;
  if (import.meta.env.DEV) {
    channelId = new URLSearchParams(window.location.search).get('channel_id');
  } else {
    channelId = currentChannelId; // Usa a var global
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
