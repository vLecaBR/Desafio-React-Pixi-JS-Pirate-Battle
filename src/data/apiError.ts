import axios from 'axios';
import { apiErrorBodySchema } from './contracts.ts';

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'contract' | 'canceled';

/** Normalised API failure, so the UI can explain it and retry policies can decide. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error)) return new ApiError('canceled', 'The request was canceled.');
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('timeout', 'The server took too long to respond.');
    }
    const status = error.response?.status;
    if (status === undefined) {
      return new ApiError('network', 'The server could not be reached.');
    }
    const body = apiErrorBodySchema.safeParse(error.response?.data);
    return body.success
      ? new ApiError('http', body.data.error.message, status, body.data.error.code)
      : new ApiError('http', `The server responded with ${status}.`, status);
  }
  return new ApiError('network', error instanceof Error ? error.message : 'Unknown error.');
}

/**
 * Transient failures are retried; client errors (4xx except 408/429), contract
 * errors and cancellations are not.
 */
export function isRetryable(error: unknown): boolean {
  const apiError = toApiError(error);
  switch (apiError.kind) {
    case 'timeout':
    case 'network':
      return true;
    case 'http':
      return (
        apiError.status === undefined ||
        apiError.status >= 500 ||
        apiError.status === 408 ||
        apiError.status === 429
      );
    case 'contract':
    case 'canceled':
      return false;
  }
}

/** Short, user-facing description of an API failure. */
export function describeApiError(error: unknown): string {
  const apiError = toApiError(error);
  switch (apiError.kind) {
    case 'timeout':
      return 'The server took too long to respond.';
    case 'network':
      return 'The server could not be reached.';
    case 'contract':
      return 'The server sent an unexpected response.';
    case 'canceled':
      return 'The request was canceled.';
    case 'http':
      return apiError.status !== undefined && apiError.status >= 500
        ? `The server is unavailable right now (${apiError.status}).`
        : `The request was rejected (${apiError.status ?? 'error'}): ${apiError.message}`;
  }
}
