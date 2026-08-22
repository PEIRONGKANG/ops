import { ApiError, type ApiErrorPayload } from './ApiError';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ApiClientOptions {
  fetch?: Fetcher;
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  clearSession: () => void;
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: BodyInit | Record<string, unknown>;
  headers?: HeadersInit;
  skipRefresh?: boolean;
}

export class ApiClient {
  private readonly fetcher: Fetcher;
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(private readonly options: ApiClientOptions) {
    this.fetcher = options.fetch ?? window.fetch.bind(window);
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: RequestOptions['body'], options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(path: string, body?: RequestOptions['body'], options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.perform<T>(path, options, false);
  }

  private async perform<T>(path: string, options: RequestOptions, retried: boolean): Promise<T> {
    const headers = new Headers(options.headers);
    const accessToken = this.options.getAccessToken();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (isJsonBody(options.body)) {
        body = JSON.stringify(options.body);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      } else {
        body = options.body;
      }
    }

    const response = await this.fetcher(path, {
      ...options,
      body,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && !retried && !options.skipRefresh) {
      const refreshed = await this.refreshOnce();
      if (refreshed) return this.perform<T>(path, options, true);
    }

    if (!response.ok) throw new ApiError(response.status, await parseErrorPayload(response));
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async refreshOnce(): Promise<string | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.options.refresh()
        .catch(() => null)
        .finally(() => { this.refreshInFlight = null; });
    }
    const token = await this.refreshInFlight;
    if (!token) this.options.clearSession();
    return token;
  }
}

function isJsonBody(body: RequestOptions['body']): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof URLSearchParams) && !(body instanceof ArrayBuffer);
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return await response.json() as ApiErrorPayload;
  } catch {
    return { message: response.statusText };
  }
}
