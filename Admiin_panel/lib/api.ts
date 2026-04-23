const getApiBase = (): string => {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  
  if (!apiBase) {
    const isProduction = process.env.NODE_ENV === 'production';
    const envFile = isProduction ? 'deployment platform' : '.env.local';
    console.error(`NEXT_PUBLIC_API_BASE is not defined. Please check your ${envFile} file.`);
    throw new Error(`API_BASE is not configured. Please set NEXT_PUBLIC_API_BASE in your ${envFile}.`);
  }
  
  let cleaned = apiBase.trim();
  cleaned = cleaned.replace(/;(?=\/|$)/g, '');
  cleaned = cleaned.replace(/[\/\s]+$/, '');
  
  return cleaned;
};

export const buildApiUrl = (path: string): string => {
  const base = getApiBase();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`.replace(/([^:]\/)\/+/g, '$1');
};

export const API_BASE = getApiBase();

