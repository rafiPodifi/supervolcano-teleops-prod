import Constants from 'expo-constants';

const PROD_TELEOPERATOR_API_BASE_URL = 'https://supervolcano-teleops.vercel.app';

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof extraUrl === 'string' && extraUrl.trim().length > 0) {
    return extraUrl.trim();
  }

  return PROD_TELEOPERATOR_API_BASE_URL;
}

