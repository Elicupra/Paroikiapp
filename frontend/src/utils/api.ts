/**
 * API Configuration and utilities
 */

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
}

export async function fetchAPI<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(path);
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `API Error: ${response.status}`);
  }

  return data;
}

export async function fetchAPIAuth<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  return fetchAPI<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
