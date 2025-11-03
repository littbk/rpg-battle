// Em src/api/apiClient.js

// 1. Obtenha a URL de produção das variáveis de ambiente do Vercel
//    (Vamos criar a 'VITE_API_URL' no Passo 3)
const PRODUCTION_URL = import.meta.env.VITE_API_URL;

// 2. A LÓGICA PRINCIPAL
//    Se estamos em desenvolvimento (npm run dev), use o proxy '/api'.
//    Se não (produção no Vercel), use a URL completa do backend.
const API_BASE_URL = import.meta.env.DEV 
  ? '/api' 
  : PRODUCTION_URL;

export default API_BASE_URL;

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