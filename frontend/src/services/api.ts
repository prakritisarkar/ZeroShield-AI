const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

export class APIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('zeroshield_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('zeroshield_token');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }

      const errorData = await response.json().catch(() => null);
      const message =
        errorData?.detail || `API Request failed with HTTP ${response.status}`;

      throw new APIError(response.status, message);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof APIError) throw error;

    throw new APIError(
      0,
      'Failed to connect to backend server. Is it running?'
    );
  }
}

export const api = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: 'GET',
    }),

  post: <T>(endpoint: string, data?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: 'DELETE',
    }),
};