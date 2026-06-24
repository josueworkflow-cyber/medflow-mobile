import axios from "axios";
import { Storage } from "../utils/storage";

// Instância base — a baseURL será sobrescrita dinamicamente no interceptor
export const api = axios.create({
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: injeta JWT Bearer Token e URL dinâmica automaticamente
api.interceptors.request.use(
  async (config) => {
    // Lê a URL salva pelo usuário (ou padrão do .env)
    const baseURL = await Storage.getApiUrl();
    config.baseURL = baseURL;

    const token = await Storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: intercepta 401 Unauthorized e limpa sessão
export const setupResponseInterceptors = (onUnauthorized: () => void): number => {
  return api.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        onUnauthorized();
      }
      return Promise.reject(error);
    }
  );
};
