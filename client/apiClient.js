// Em src/api/apiClient.js

// 1. Obtenha a URL de produção das variáveis de ambiente do Vercel
//    (Vamos criar a 'VITE_API_URL' no Passo 3)

// ---- BÔNUS: Se você usa AXIOS ----
// Você pode fazer isso para ter um cliente pronto para usar:
//
// import axios from 'axios';
//
// const apiClient = axios.create({
//   baseURL: API_BASE_URL,
// });
//
// export default apiClient;