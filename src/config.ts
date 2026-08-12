import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const STORAGE_KEY = '@sorteo_api_url';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; apiPort?: number };

let override: string | null = null;

function normalizeBaseUrl(url: string): string {
  const t = url.trim();
  return t.endsWith('/') ? t.slice(0, -1) : t;
}

function hostOfBaseUrl(url: string): string | null {
  try {
    return new URL(normalizeBaseUrl(url)).hostname || null;
  } catch {
    return null;
  }
}

function isLoopbackHost(host: string | null): boolean {
  return host === '127.0.0.1' || host === 'localhost';
}

/** Host desde el que Metro sirve el JS (fiable para distinguir emulador Android). */
function bundlePackagerHostname(): string | null {
  const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL;
  if (!scriptURL || typeof scriptURL !== 'string') return null;
  if (!/^https?:/i.test(scriptURL)) return null;
  try {
    return new URL(scriptURL).hostname || null;
  } catch {
    return null;
  }
}

function isAndroidEmulatorByConstants(): boolean {
  if (Platform.OS !== 'android') return false;
  const c = Platform.constants as { Fingerprint?: string; Model?: string; Brand?: string };
  const fingerprint = String(c?.Fingerprint ?? '');
  const model = String(c?.Model ?? '');
  const brand = String(c?.Brand ?? '');
  const blob = `${model} ${brand} ${fingerprint}`;
  return /generic|unknown|google_sdk|Emulator|Android SDK built for x86|ranchu|gphone|sdk_gphone|sdk_phone|vbox86p|goldfish|qemu|Cuttlefish|emu64|aosp|userdebug|test-keys|16k|phone16/i.test(
    blob
  );
}

/** Emulador AVD: el bundle suele venir de 10.0.2.2 (host); en API recientes el modelo no siempre coincide con regex. */
function isAndroidLikelyEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  if (isAndroidEmulatorByConstants()) return true;
  const h = bundlePackagerHostname();
  return h === '10.0.2.2' || h === '127.0.0.1' || h === 'localhost';
}

function apiPort(): number {
  const raw = (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_API_PORT;
  const n = raw ? parseInt(String(raw), 10) : NaN;
  if (!Number.isNaN(n) && n > 0 && n < 65536) return n;
  const x = extra.apiPort;
  if (typeof x === 'number' && x > 0 && x < 65536) return x;
  return 3000;
}

/** Host donde Metro/Expo sirve el bundle (misma IP que exp://…:8081 en la terminal). */
function hostFromExpoDev(): string | null {
  const fromBundle = bundlePackagerHostname();
  if (fromBundle && !isLoopbackHost(fromBundle)) return fromBundle;

  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0]?.trim();
    if (host && !isLoopbackHost(host)) return host;
  }
  const eg = Constants.expoGoConfig as { debuggerHost?: string } | null | undefined;
  const dh = eg?.debuggerHost;
  if (typeof dh === 'string' && dh.length > 0) {
    const host = dh.split(':')[0]?.trim();
    if (host && !isLoopbackHost(host)) return host;
  }
  return fromBundle;
}

/**
 * URL base del API sin override del usuario.
 * - EXPO_PUBLIC_API_URL: URL completa (prioridad).
 * - __DEV__: emulador Android → 10.0.2.2; iOS simulador → localhost; dispositivo real → host del bundler.
 * - Producción: `extra.apiUrl` en app.json.
 */
export function resolveAutoApiBaseUrl(): string {
  const envUrl = (process as { env?: Record<string, string> }).env?.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return normalizeBaseUrl(envUrl);

  const port = apiPort();
  const fromExtra = typeof extra.apiUrl === 'string' ? extra.apiUrl.trim() : '';

  if (__DEV__) {
    const devHost = hostFromExpoDev();
    if (Platform.OS === 'android') {
      if (isAndroidLikelyEmulator()) {
        return `http://10.0.2.2:${port}`;
      }
      if (devHost) return `http://${devHost}:${port}`;
      return `http://10.0.2.2:${port}`;
    }
    if (devHost) return `http://${devHost}:${port}`;
    return `http://localhost:${port}`;
  }

  if (fromExtra) return normalizeBaseUrl(fromExtra);
  return `http://localhost:${port}`;
}

export function getApiBaseUrl(): string {
  const url = override ?? resolveAutoApiBaseUrl();
  return normalizeBaseUrl(url);
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
    if (!stored?.trim()) return;
    const normalized = normalizeBaseUrl(stored);
    const auto = resolveAutoApiBaseUrl();

    if (__DEV__) {
      const extraFallback = typeof extra.apiUrl === 'string' ? normalizeBaseUrl(extra.apiUrl) : '';
      const storedHost = hostOfBaseUrl(normalized);
      const autoHost = hostOfBaseUrl(auto);
      const stale =
        normalized === extraFallback ||
        (storedHost && autoHost && storedHost !== autoHost);
      if (stale) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        override = null;
        return;
      }
    }

    override = normalized;
  } catch {
    // ignorar
  }
}
