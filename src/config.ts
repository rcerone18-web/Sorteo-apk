import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sorteo_api_url';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
const fromEnv = typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL;
const DEFAULT_URL = fromEnv || extra.apiUrl || 'http://192.168.100.210:3000';

let override: string | null = null;

export function getApiBaseUrl(): string {
  const url = override ?? DEFAULT_URL;
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function setApiBaseUrlOverride(url: string | null): Promise<void> {
  override = url ? url.trim() || null : null;
  if (override) {
    await AsyncStorage.setItem(STORAGE_KEY, override);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function initConfig(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) override = stored.trim();
  } catch {
    // ignorar
  }
}

export { DEFAULT_URL };
