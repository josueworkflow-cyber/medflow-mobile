import { api } from "./client";
import { Usuario } from "../store/AuthContext";

interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export const AuthAPI = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>("/api/mobile/auth/login", {
      email,
      password,
    });
    return response.data;
  },
};
