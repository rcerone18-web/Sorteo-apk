import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
export const API_BASE_URL = extra.apiUrl || 'http://192.168.1.100:3000';
