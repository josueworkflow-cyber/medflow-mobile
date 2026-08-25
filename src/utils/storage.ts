import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@dachospitalar:token";
const USER_KEY = "@dachospitalar:user";
const API_URL_KEY = "@dachospitalar:apiUrl";

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000";
const FORCE_DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_FORCE_DEFAULT === "true";

export const Storage = {
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async saveUser(user: any): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<any | null> {
    const userStr = await AsyncStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(USER_KEY);
  },

  async saveApiUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(API_URL_KEY, url);
  },

  async getApiUrl(): Promise<string> {
    if (FORCE_DEFAULT_API_URL) {
      return DEFAULT_API_URL;
    }

    const saved = await AsyncStorage.getItem(API_URL_KEY);
    return saved || DEFAULT_API_URL;
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
};
