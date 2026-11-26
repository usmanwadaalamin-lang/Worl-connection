export type ThinkMode = 'chat' | 'analyze_post' | 'draft_post';

export interface ThinkHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ThinkResponse {
  answer: string;
  model: string;
  thinkingLevel: string;
}

export function extractReadableError(
  err: unknown,
  fallback = 'Ba a iya kammala wannan buƙatar a yanzu ba. Da fatan a sake gwadawa.',
): string {
  const cleanText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[object Object]') return null;
    return trimmed;
  };

  const direct = cleanText(err);
  if (direct) return direct;

  if (err && typeof err === 'object') {
    const obj = err as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      statusText?: unknown;
    };

    const nestedError =
      obj.error && typeof obj.error === 'object'
        ? (obj.error as { message?: unknown; error?: unknown })
        : null;

    const candidates: unknown[] = [
      obj.message,
      nestedError?.message,
      obj.error,
      nestedError?.error,
      obj.details,
      obj.statusText,
    ];

    for (const candidate of candidates) {
      const s = cleanText(candidate);
      if (s) return s;
      if (candidate && typeof candidate === 'object') {
        const deep = cleanText((candidate as { message?: unknown }).message);
        if (deep) return deep;
      }
    }

    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}' && json !== '[]') {
        return json.length > 220 ? `${json.slice(0, 220)}...` : json;
      }
    } catch {
      // Ignore circular object serialization issues
    }
  }

  return fallback;
}

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function queryDeepThink(params: {
  prompt: string;
  context?: string;
  mode?: ThinkMode;
  history?: ThinkHistoryTurn[];
}): Promise<ThinkResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);

  let response: Response;
  try {
    response = await fetch('/api/think', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Amsa ta ɗauki lokaci mai tsawo (timeout). Duba haɗin yanar gizonka ka sake gwadawa.',
      );
    }
    throw new Error(
      'Ba a iya haɗawa da World Connection AI a halin yanzu ba. Duba yanar gizonka ka sake gwadawa.',
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const rawText = await response.text().catch(() => '');
  const contentType = response.headers.get('content-type') || '';
  const payload = parseJsonObject(rawText);

  if (!payload) {
    if (rawText.trim().startsWith('<') || contentType.includes('text/html')) {
      throw new Error(
        `World Connection AI ba ta samuwa a wannan adireshin a halin yanzu (HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      throw new Error(
        extractReadableError(
          rawText,
          `World Connection AI ba ta samuwa a halin yanzu (HTTP ${response.status}).`,
        ),
      );
    }
    throw new Error('World Connection AI ta dawo da amsar da ba a gane ba. Sake gwadawa.');
  }

  if (!response.ok) {
    throw new Error(
      extractReadableError(
        payload,
        `Ba a iya samun amsa daga World Connection AI ba (HTTP ${response.status}).`,
      ),
    );
  }

  const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
  if (!answer) {
    throw new Error('World Connection AI ba ta dawo da amsa ba. Da fatan a sake gwadawa.');
  }

  return {
    answer,
    model: typeof payload.model === 'string' ? payload.model : 'gemini-2.5-flash',
    thinkingLevel: typeof payload.thinkingLevel === 'string' ? payload.thinkingLevel : 'LOW',
  };
}

export type TranslationTarget = 'Hausa' | 'English' | 'Arabic' | 'French';

async function postChatAiJson<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs = 45000,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error('Unable to connect to the AI service right now.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  const rawText = await response.text().catch(() => '');
  const trimmed = rawText.trim();
  const contentType = response.headers.get('content-type') || '';

  const payload = parseJsonObject(trimmed) as (T & Record<string, unknown>) | null;

  if (!payload) {
    if (trimmed.startsWith('<') || contentType.includes('text/html')) {
      throw new Error(
        `AI service is temporarily unavailable at this address (HTTP ${response.status}). Please refresh and try again.`,
      );
    }
    throw new Error(
      extractReadableError(
        trimmed,
        `AI service returned an unexpected response (HTTP ${response.status}).`,
      ),
    );
  }

  if (!response.ok) {
    throw new Error(
      extractReadableError(
        payload,
        `Unable to complete request (HTTP ${response.status}). Please try again.`,
      ),
    );
  }
  return payload;
}

export async function translateChatMessage(params: {
  text: string;
  targetLanguage: TranslationTarget;
}): Promise<{ translatedText: string; targetLanguage: TranslationTarget }> {
  const data = await postChatAiJson<{
    translatedText?: string;
    targetLanguage?: TranslationTarget;
  }>('/api/translate', params, 45000);
  if (!data.translatedText) {
    throw new Error('No translation returned. Please try again.');
  }
  return {
    translatedText: data.translatedText,
    targetLanguage: data.targetLanguage ?? params.targetLanguage,
  };
}

export async function transcribeVoiceNote(params: {
  audioData: string;
}): Promise<{ transcript: string }> {
  const data = await postChatAiJson<{ transcript?: string }>(
    '/api/transcribe',
    params,
    48000,
  );
  if (!data.transcript) {
    throw new Error('No speech transcript returned.');
  }
  return { transcript: data.transcript };
}

export async function summarizeChatRoom(params: {
  roomName: string;
  roomType: 'group' | 'channel';
  uiLanguage: 'ha' | 'en';
  messages: Array<{ senderName: string; text: string; timestamp?: string }>;
}): Promise<{ summary: string; messageCount: number }> {
  const data = await postChatAiJson<{
    summary?: string;
    messageCount?: number;
  }>('/api/summarize-chat', params, 35000);
  if (!data.summary) {
    throw new Error('No summary returned.');
  }
  return {
    summary: data.summary,
    messageCount: data.messageCount ?? params.messages.length,
  };
}
