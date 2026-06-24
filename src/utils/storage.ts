import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@medflow:token";
const USER_KEY = "@medflow:user";
const API_URL_KEY = "@medflow:apiUrl";

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000";

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
    const saved = await AsyncStorage.getItem(API_URL_KEY);
    return saved || DEFAULT_API_URL;
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
};
