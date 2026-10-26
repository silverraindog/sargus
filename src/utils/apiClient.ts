/**
 * Robust API Client with safe JSON parsing, Content-Type verification,
 * and rate-limit (Cloud Run / 429) backoff handling.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  isRateLimited?: boolean;
}

// Global timestamp to throttle outgoing requests after a 429 or rate limit response
let rateLimitCooldownUntil = 0;

export function isCurrentlyRateLimited(): boolean {
  return Date.now() < rateLimitCooldownUntil;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  // If in active rate-limit cooldown, fail-fast without hitting server
  const now = Date.now();
  if (now < rateLimitCooldownUntil) {
    return {
      ok: false,
      status: 429,
      isRateLimited: true,
      error: 'Rate limit cooldown in progress. Backing off requests...',
    };
  }

  try {
    const res = await fetch(input, init);

    // Explicit HTTP 429 Too Many Requests
    if (res.status === 429) {
      rateLimitCooldownUntil = Date.now() + 6000; // 6s backoff
      return {
        ok: false,
        status: 429,
        isRateLimited: true,
        error: 'Rate limit exceeded. Waiting before retrying...',
      };
    }

    const contentType = res.headers.get('content-type') || '';

    // Handle non-JSON responses (e.g. text/plain "Rate exceeded." or HTML error pages)
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (text.toLowerCase().includes('rate exceeded')) {
        rateLimitCooldownUntil = Date.now() + 6000;
        return {
          ok: false,
          status: 429,
          isRateLimited: true,
          error: 'Rate limit exceeded. Waiting before retrying...',
        };
      }

      return {
        ok: false,
        status: res.status,
        error: res.ok
          ? 'Unexpected non-JSON response from server'
          : `Server error (HTTP ${res.status})`,
      };
    }

    // Safely parse JSON
    const data = await res.json();

    if (!res.ok) {
      const errMsg =
        data?.error
          ? typeof data.error === 'string'
            ? data.error
            : data.error.error || 'API Request failed'
          : `Server returned HTTP ${res.status}`;

      return {
        ok: false,
        status: res.status,
        error: errMsg,
        data,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Network request failed',
    };
  }
}
