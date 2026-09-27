/**
 * Safe Single-Read Response Body Consumer
 * Consumes a Fetch Response body stream exactly once and derives JSON or text.
 * Prevents "TypeError: Failed to execute 'text' on 'Response': body stream already read".
 * Safely handles standard Response, bodyUsed responses, plain text, JSON, and mock responses.
 */

export interface ConsumedResponse<T = any> {
  ok: boolean;
  status: number;
  headers: Headers;
  text: string;
  data: T | null;
  isJson: boolean;
  errorMessage: string;
}

export async function safeConsumeResponse<T = any>(
  response: Response | any
): Promise<ConsumedResponse<T>> {
  let text = '';
  let data: T | null = null;
  let isJson = false;

  if (response) {
    if (response.bodyUsed) {
      // Body stream was already read elsewhere — handle safely without re-reading
      text = '';
    } else if (typeof response.text === 'function') {
      try {
        text = await response.text();
      } catch (err: any) {
        // Prevent body stream already read unhandled crashes
        text = err?.message || '';
      }
    } else if (typeof response.json === 'function') {
      try {
        data = await response.json();
        text = typeof data === 'string' ? data : JSON.stringify(data);
        isJson = true;
      } catch (err: any) {
        text = err?.message || '';
      }
    } else if (typeof response.body === 'string') {
      text = response.body;
    }
  }

  if (!isJson && text && text.trim().length > 0) {
    try {
      data = JSON.parse(text) as T;
      isJson = true;
    } catch {
      data = null;
      isJson = false;
    }
  }

  let errorMessage = '';
  if (data && typeof data === 'object') {
    if ('message' in data && typeof (data as any).message === 'string') {
      errorMessage = (data as any).message;
    } else if ('error' in data) {
      const errField = (data as any).error;
      errorMessage = typeof errField === 'string' ? errField : errField?.message || '';
    }
  }

  if (!errorMessage) {
    errorMessage = text || `GitHub API request failed with status ${response?.status ?? 0}`;
  }

  const ok = Boolean(
    response?.ok ?? (response?.status ? response.status >= 200 && response.status < 300 : true)
  );
  const status = typeof response?.status === 'number' ? response.status : ok ? 200 : 500;
  const headers = response?.headers || new Headers();

  return {
    ok,
    status,
    headers,
    text,
    data,
    isJson,
    errorMessage,
  };
}
