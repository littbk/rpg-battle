// Trigger deploy
import API_BASE_URL from './apiClient.js';

import { DiscordSDK } from "@discord/embedded-app-sdk";

import rocketLogo from '/rocket.png';
import "./style.css";

// Will eventually store the authenticated user's access_token
let auth;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
console.log('env')
console.log(import.meta.env.VITE_DISCORD_CLIENT_ID)

setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

});

async function testApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/alguma-rota`);
    const data = await response.json();
    console.log(data);
  } catch (err) {
    console.error("Erro ao testar API:", err);
  }
}

testApi();


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
      "applications.commands"
    ],
  });

  // Retrieve an access_token from your activity's server
  const response = await fetch("/api/token", {
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
 * * NOTA: Esta função DEVE ser chamada APÓS discordSdk.ready() ou discordSdk.authenticate().
 */
async function appendChannelName() {
    const app = document.querySelector('#channel-name');
    // Limpa o conteúdo anterior enquanto carrega
    if (app) {
        app.innerHTML = '<p>Carregando nome do canal...</p>';
    }
    
    let activityChannelName = 'Unknown';
    // 1. Verificação de Contexto (Garante que estamos em um servidor e canal)
    if (discordSdk.channelId && discordSdk.guildId) {
        
        // 2. Uso do Try/Catch para RPC (Para lidar com falhas de comunicação)
        try {
            // Tenta obter as informações do canal via RPC
            const channel = await discordSdk.commands.getChannel({
                channel_id: discordSdk.channelId
            });

            console.log('Channel Data Received:', channel);

            // 3. Verifica o retorno
            if (channel && channel.name) {
                activityChannelName = channel.name;
            } else {
                 // Adiciona mais detalhes em caso de retorno inesperado
                 console.warn("getChannel retornou sem nome ou objeto de canal válido.");
                 activityChannelName = "Canal Desconhecido (API)";
            }
            
        } catch (error) {
            // Se o comando RPC falhar (falha de comunicação com o Discord Client)
            console.error("Erro RPC. Falha ao obter o canal. Causas comuns: Timing ou Permissão do Usuário.", error);
            activityChannelName = "Canal da Atividade (RPC Falhou)"; 
        }
    } else {
        // App está sendo executado fora do contexto esperado (ex: navegadores sem o cliente Discord)
        activityChannelName = "Fora de Contexto de Atividade";
    }

    // 4. Atualiza a UI
    const textTagString = `Activity Channel: "${activityChannelName}"`;
    const textTag = document.createElement('p');
    textTag.textContent = textTagString;
    
    // Atualiza apenas se o elemento for encontrado
    if (app) {
        app.innerHTML = textTag.outerHTML;
    }
}

async function appendUserAvatar() {
  
  const logoImg = document.querySelector('img.logo');
  if (!logoImg) return;

  // 1️⃣ Busca os dados do usuário autenticado
  const user = await fetch(`https://discord.com/api/v10/users/@me`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());

  // 2️⃣ Monta a URL do avatar
  // Se o usuário tiver avatar personalizado, usamos ele
  // Caso contrário, usamos o avatar padrão (default avatar)
  //let responsePlayer = await fetch(`/api/retornar-ficha?user=${encodeURIComponent(JSON.stringify(user))}`);
  //let p = await responsePlayer.json(); // agora p é o objeto JS retornado pelo servidor
  let avatarUrl
  
  if (user.avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`;
  } else {
    const defaultAvatarIndex = user.discriminator % 5; // usado em contas antigas
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
  }


  // 3️⃣ Substitui a imagem do logo pelo avatar do usuário
  logoImg.src = avatarUrl;
  logoImg.alt = `${user.username} avatar`;
  logoImg.width = 128;
  logoImg.height = 128;
  logoImg.style.borderRadius = '50%';
}

// Nota: Certifique-se que esta função só é chamada DEPOIS que a função
// de inicialização do Discord SDK (e possivelmente a autenticação) for concluída.


async function fetchBattleQueue() {
   
  const channelId = discordSdk.channelId;
  const turnOrderContainer = document.querySelector('#turn-order-list');

  if (!channelId) { 
    if (turnOrderContainer) turnOrderContainer.innerHTML = "<p>ID do Canal não encontrado.</p>";
    return;
  }

  try {
    const response = await fetch(`/api/get-battle-queue?channel=${channelId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
    }

    const battleData = await response.json();
    console.log(battleData)
    const fila = JSON.parse(battleData.fila);
    const jogadorAtual = battleData.jogadorAtual;

    // Verifica se o jogadorAtual é válido e tem a propriedade 'nome' para comparação
if (jogadorAtual) {
    // 1. Encontra o ÍNDICE do jogador na fila que tem o mesmo nome
    const indiceDoJogador = fila.findIndex(jogador => 
        jogador.nome === jogadorAtual
    );

    // 2. Se o jogador for encontrado (indiceDoJogador !== -1)
    if (indiceDoJogador !== -1) {
        
        // 3. Remove o jogador da posição atual e o armazena
        // splice(indice, 1) retorna um array com o elemento removido
        const [jogadorPrioritario] = fila.splice(indiceDoJogador, 1);
        
        // 4. Define o step para 9999
        jogadorPrioritario.step = 9999;
        
        // 5. Coloca o jogador modificado no TOPO (início) da fila
        fila.unshift(jogadorPrioritario);
    }
}
    

    // 1. Filtra apenas lutadores "ativos"
    const lutadoresAtivos = fila.filter(p => p.ativo === true);

    // 2. Ordena os ativos pelo 'step', do MAIOR para o MENOR
    // (Assumindo que step mais alto joga primeiro)
    lutadoresAtivos.sort((a, b) => b.step - a.step);

    // 3. Gera o HTML da lista
    if (lutadoresAtivos.length > 0) {
      
      // 1. REMOVE o primeiro lutador (o prioritário) e o armazena.
      // O array lutadoresAtivos é modificado (agora ele começa no segundo elemento original).
      const lutadorPrioritario = lutadoresAtivos.shift(); 

      // 2. Cria o <li> do primeiro item, adicionando a classe .prioritario
      const primeiroItemHtml = `<li><strong class="prioritario">${lutadorPrioritario.nome}</strong> (Step: ${lutadorPrioritario.step})</li>`;
      
      // 3. Mapeia o RESTO do array (lutadoresAtivos) normalmente
      const restanteItensHtml = lutadoresAtivos.map(player => 
        // O restante é adicionado sem a classe .prioritario
        `<li><strong>${player.nome}</strong> (Step: ${player.step})</li>`
      ).join('');

      // 4. Combina o item prioritário e o resto em uma única lista HTML
      const htmlList = `
        <ol>
          ${primeiroItemHtml}
          ${restanteItensHtml}
        </ol>
      `;
      
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



// Esta variável impede que o loop comece antes do SDK estar pronto
let isSdkReady = true; 

setupDiscordSdk().then(() => {
  console.log("Discord SDK está autenticado e pronto.");
  isSdkReady = true;
});

// Inicia o loop de atualização (Polling)
// A cada 2 segundos (2000ms), ele vai chamar a função fetchBattleQueue
setInterval(() => {
  // Só roda a função se o SDK estiver pronto (já temos o channelId)
  if (isSdkReady) {
    fetchBattleQueue();
    appendUserAvatar()
    appendChannelName()
  }
}, 2000); // 2000ms = 2 segundos. Você pode mudar este valor.