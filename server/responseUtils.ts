/**
 * COSInput - Response Utilities
 * Strictly enforces single-read response body handling across all HTTP and GitHub API interactions.
 * Prevents "Failed to execute 'text' on 'Response': body stream already read" errors.
 */

import type { SanitizedGitHubError } from './types';
import { classifyGitHubError } from './githubClient';

export interface SafeParsedResponse<T = any> {
  text: string;
  json: T | null;
  isJson: boolean;
  ok: boolean;
  status: number;
}

/**
 * Consumes a Fetch Response stream EXACTLY ONCE.
 * Safely extracts text and parses JSON without secondary body reads.
 */
export async function safeParseResponse<T = any>(response: Response | any): Promise<SafeParsedResponse<T>> {
  if (response.bodyUsed) {
    throw new Error("Failed to execute 'text' on 'Response': body stream already read");
  }

  let text = '';
  let json: T | null = null;
  let isJson = false;

  if (typeof response.text === 'function') {
    text = await response.text();
    if (text && text.trim().length > 0) {
      try {
        json = JSON.parse(text) as T;
        isJson = true;
      } catch {
        json = null;
        isJson = false;
      }
    }
  } else if (typeof response.json === 'function') {
    try {
      json = (await response.json()) as T;
      isJson = true;
      text = typeof json === 'string' ? json : JSON.stringify(json);
    } catch {
      json = null;
      isJson = false;
    }
  }

  return {
    text,
    json,
    isJson,
    ok: response.ok ?? true,
    status: response.status ?? 200,
  };
}

/**
 * Extracts a sanitized error from a Fetch Response using safe single-read body consumption.
 */
export async function safeExtractGitHubError(response: Response): Promise<SanitizedGitHubError> {
  try {
    const { text, json, isJson } = await safeParseResponse(response);
    const rawMessage = (isJson && json && (json.message || json.error)) ? String(json.message || json.error) : text;
    return classifyGitHubError(response.status, rawMessage, response.headers);
  } catch (err: any) {
    return classifyGitHubError(response.status, err?.message || `HTTP ${response.status}`, response.headers);
  }
}
