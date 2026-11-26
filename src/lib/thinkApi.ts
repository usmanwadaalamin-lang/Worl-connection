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
      headers: {
        'Content-Type': 'application/json',
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

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(
        `World Connection AI ba ta samuwa a wannan adireshin (HTTP ${response.status}).`,
      );
    }
    throw new Error('World Connection AI service returned an unexpected response.');
  }

  const payload = (await response.json().catch(() => ({}))) as {
    answer?: string;
    model?: string;
    thinkingLevel?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || `Request failed with status ${response.status}`,
    );
  }

  if (!payload.answer) {
    throw new Error('No response returned from World Connection AI.');
  }

  return {
    answer: payload.answer,
    model: payload.model ?? 'gemini-4-hydrogen',
    thinkingLevel: payload.thinkingLevel ?? 'LOW',
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

  let payload: (T & { error?: string }) | null = null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || contentType.includes('application/json')) {
    try {
      payload = JSON.parse(trimmed) as T & { error?: string };
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    if (trimmed.startsWith('<') || contentType.includes('text/html')) {
      throw new Error(
        `Preview server returned a webpage instead of AI JSON (HTTP ${response.status}). Please refresh the page and try again.`,
      );
    }
    throw new Error(
      `AI service returned an unexpected response (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error || `Request failed with status ${response.status}`,
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
    throw new Error('No translation returned.');
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

