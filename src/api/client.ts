import axios from "axios";
import { Storage } from "../utils/storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: injetar JWT Bearer Token automaticamente
api.interceptors.request.use(
  async (config) => {
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
