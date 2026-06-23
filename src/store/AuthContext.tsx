import React, { createContext, useReducer, useEffect, ReactNode } from "react";
import { Storage } from "../utils/storage";

export interface Usuario {
  id: number;
  nome: string;
  perfil: "ESTOQUE" | "ADMINISTRADOR";
}

interface AuthState {
  token: string | null;
  user: Usuario | null;
  isLoading: boolean;
}

type AuthAction =
  | { type: "SIGN_IN"; payload: { token: string; user: Usuario } }
  | { type: "SIGN_OUT" }
  | { type: "RESTORE_TOKEN"; payload: { token: string | null; user: Usuario | null } };

const initialState: AuthState = {
  token: null,
  user: null,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "RESTORE_TOKEN":
      return {
        ...state,
        token: action.payload.token,
        user: action.payload.user,
        isLoading: false,
      };
    case "SIGN_IN":
      return {
        ...state,
        token: action.payload.token,
        user: action.payload.user,
        isLoading: false,
      };
    case "SIGN_OUT":
      return {
        ...state,
        token: null,
        user: null,
        isLoading: false,
      };
    default:
      return state;
  }
}

interface AuthContextType {
  state: AuthState;
  signIn: (token: string, user: Usuario) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token = null;
      let user = null;
      try {
        token = await Storage.getToken();
        user = await Storage.getUser();
      } catch (e) {
        console.error("Erro ao restaurar dados de autenticação:", e);
      }
      dispatch({ type: "RESTORE_TOKEN", payload: { token, user } });
    };

    bootstrapAsync();
  }, []);

  const signIn = async (token: string, user: Usuario) => {
    await Storage.saveToken(token);
    await Storage.saveUser(user);
    dispatch({ type: "SIGN_IN", payload: { token, user } });
  };

  const signOut = async () => {
    await Storage.clearAll();
    dispatch({ type: "SIGN_OUT" });
  };

  return (
    <AuthContext.Provider value={{ state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
