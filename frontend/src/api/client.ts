/**
 * Base HTTP client for REST API communication.
 * Standardizes request configuration, JSON headers, and error parsing.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, message: string, code: string = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      'Unable to connect to the backend server. Please verify the API server is running.',
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    let errorCode = 'HTTP_ERROR';

    try {
      const data = await response.json();
      if (data.error) {
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else {
          errorMessage = data.error.message || errorMessage;
          errorCode = data.error.code || errorCode;
        }
      }
    } catch {
      // response is not JSON
    }

    throw new ApiError(response.status, errorMessage, errorCode);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
