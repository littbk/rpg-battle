// --- TESTE À PROVA DE ERROS (DISCORD EMBED) ---
// Pode ser colado diretamente no main.js para validar o funcionamento do front no Discord

import "./style.css";

// --- CONFIGURAÇÕES SEGURAS ---
const ENV = {
  VITE_API_URL: import.meta.env.VITE_API_URL || "https://example.com",
  VITE_DISCORD_CLIENT_ID: import.meta.env.VITE_DISCORD_CLIENT_ID || "123456789012345678",
};

const API_BASE_URL = import.meta.env.DEV ? "" : ENV.VITE_API_URL;

// --- LOGO PADRÃO ---
import rocketLogo from "/rocket.png";

// --- ESTADO GLOBAL ---
let auth = null;
let isSdkReady = false;
let discordSdk = null;

// --- HTML BASE ---
document.querySelector("#app").innerHTML = `
  <div class="test-wrapper">
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h2>Atividade de Teste</h2>
    <div id="status" class="card">Inicializando...</div>
    <div id="turn-order-list" class="card">Carregando fila...</div>
  </div>
`;

// --- FUNÇÃO DE CARREGAMENTO SEGURO DO SDK ---
async function loadDiscordSDK() {
  try {
    const mod = await import("@discord/embedded-app-sdk");
    return mod.DiscordSDK;
  } catch (err) {
    console.warn("[AVISO] SDK não encontrado. Usando simulação local.", err);
    return class FakeSDK {
      constructor() {
        this.channelId = "fakeChannel";
        this.guildId = "fakeGuild";
        this.commands = {
          authorize: async () => ({ code: "fake-code" }),
          authenticate: async () => ({ access_token: "fake-token" }),
          getChannel: async () => ({ name: "canal-de-teste" }),
        };
      }
      async ready() { console.log("[SDK Simulado] ready()"); }
    };
  }
}

// --- INICIALIZAÇÃO ---
(async () => {
  const DiscordSDK = await loadDiscordSDK();
  discordSdk = new DiscordSDK(ENV.VITE_DISCORD_CLIENT_ID);

  appendUserAvatar();
  setupDiscordSdk().then(() => {
    console.log("✅ SDK autenticado e pronto!");
    isSdkReady = true;
    document.getElementById("status").innerHTML = "✅ SDK autenticado com sucesso!";
    fetchBattleQueue();
  }).catch((err) => {
    console.error("❌ Erro no setup do SDK:", err);
    document.getElementById("status").innerHTML = "❌ Falha ao iniciar SDK.";
  });

  // Atualiza a “fila fake” periodicamente
  setInterval(() => {
    if (isSdkReady) fetchBattleQueue();
  }, 3000);
})();

// --- FUNÇÕES ---
async function setupDiscordSdk() {
  try {
    await discordSdk.ready();
    const { code } = await discordSdk.commands.authorize({
      client_id: ENV.VITE_DISCORD_CLIENT_ID,
      response_type: "code",
      scope: ["identify", "guilds"],
      prompt: "none",
    });
    auth = await discordSdk.commands.authenticate({ access_token: "fake-access-token" });
    console.log("[setupDiscordSdk] OK com code:", code);
  } catch (err) {
    console.error("Erro no setupDiscordSdk:", err);
    throw err;
  }
}

function appendUserAvatar() {
  const logoImg = document.querySelector("img.logo");
  logoImg.src = "https://cdn.discordapp.com/embed/avatars/4.png";
  logoImg.alt = "Avatar de Teste";
  logoImg.style.borderRadius = "50%";
}

async function fetchBattleQueue() {
  const el = document.getElementById("turn-order-list");
  try {
    const fakeQueue = [
      { nome: "Alice", step: 99 },
      { nome: "Bob", step: 87 },
      { nome: "Carol", step: 65 },
    ];
    const html = fakeQueue.map(p => `<li><strong>${p.nome}</strong> (Step: ${p.step})</li>`).join("");
    el.innerHTML = `<ol>${html}</ol>`;
  } catch (err) {
    console.error("Erro ao atualizar fila:", err);
    el.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}
