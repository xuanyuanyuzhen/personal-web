export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  body?: unknown;
  method?: HttpMethod;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

let unauthorizedHandler: (() => void) | undefined;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

function isJsonBody(body: unknown): body is Record<string, unknown> | unknown[] {
  return typeof body === 'object' && body !== null && !(body instanceof FormData);
}

async function readResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (typeof payload === 'object' && payload !== null) {
    const value = payload as { error?: unknown; message?: unknown };

    if (typeof value.message === 'string' && value.message.trim()) {
      return value.message;
    }

    if (Array.isArray(value.message) && value.message.length > 0) {
      return value.message.join('；');
    }

    if (typeof value.error === 'string' && value.error.trim()) {
      return value.error;
    }
  }

  return fallback;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, method, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  const init: RequestInit = {
    ...fetchOptions,
    credentials: 'include',
    headers,
    method: method ?? (body === undefined ? 'GET' : 'POST'),
  };

  if (body !== undefined) {
    if (isJsonBody(body)) {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body);
    } else {
      init.body = body as BodyInit;
    }
  }

  const response = await fetch(`/api${path}`, init);
  const payload = await readResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    throw new ApiError(getErrorMessage(payload, response.statusText || '请求失败'), response.status, payload);
  }

  return payload as T;
}
