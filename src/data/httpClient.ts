import axios, { type AxiosInstance } from 'axios';
import type { z } from 'zod';
import { ApiError, toApiError } from './apiError.ts';
import { API_BASE_URL } from './contracts.ts';

function timeoutFromEnv(): number {
  const raw = Number(import.meta.env.VITE_API_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 4000;
}

/** Creates the Axios instance used for the ranking and history API. */
export function createHttpClient(options: { timeoutMs?: number } = {}): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: options.timeoutMs ?? timeoutFromEnv(),
    headers: { Accept: 'application/json' },
  });
  // Every failure leaves the client as a normalised ApiError.
  client.interceptors.response.use(undefined, (error: unknown) =>
    Promise.reject(toApiError(error)),
  );
  return client;
}

export const httpClient = createHttpClient();

/** Validates a response payload; a mismatch is reported as a contract error. */
export function parseResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('contract', 'The server sent an unexpected response.');
  }
  return parsed.data;
}
