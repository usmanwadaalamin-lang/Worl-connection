import dns from 'dns/promises';
import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ApiRequestLike {
  method?: string;
  url?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  on?: IncomingMessage['on'];
  [Symbol.asyncIterator]?: IncomingMessage[typeof Symbol.asyncIterator];
}

export interface ApiResponseLike {
  statusCode?: number;
  headersSent?: boolean;
  setHeader?: (name: string, value: string) => unknown;
  status?: (code: number) => ApiResponseLike;
  json?: (body: unknown) => unknown;
  end?: (chunk?: string) => unknown;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

export function sendJson(
  res: ApiResponseLike | ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  const anyRes = res as ApiResponseLike;
  if (typeof anyRes.setHeader === 'function') {
    anyRes.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  if (typeof anyRes.status === 'function' && typeof anyRes.json === 'function') {
    const chained = anyRes.status(statusCode);
    if (chained && typeof chained.json === 'function') {
      chained.json(payload);
      return;
    }
    anyRes.json(payload);
    return;
  }
  anyRes.statusCode = statusCode;
  if (typeof anyRes.end === 'function') {
    anyRes.end(JSON.stringify(payload));
  }
}

export async function readJsonBody(
  req: ApiRequestLike | IncomingMessage,
): Promise<Record<string, unknown>> {
  const anyReq = req as ApiRequestLike;
  if (anyReq.body !== undefined && anyReq.body !== null) {
    if (typeof anyReq.body === 'string') {
      const trimmed = anyReq.body.trim();
      if (!trimmed) return {};
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(anyReq.body)) {
      const trimmed = anyReq.body.toString('utf8').trim();
      if (!trimmed) return {};
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    if (typeof anyReq.body === 'object' && !Array.isArray(anyReq.body)) {
      return anyReq.body as Record<string, unknown>;
    }
    return {};
  }

  if (typeof anyReq[Symbol.asyncIterator] !== 'function') {
    return {};
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of anyReq as AsyncIterable<Buffer | string>) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Request payload too large.'), { status: 413 });
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw Object.assign(new Error('Invalid JSON request body.'), { status: 400 });
  }
}

function ensurePostMethod(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    const anyRes = res as ApiResponseLike;
    anyRes.statusCode = 204;
    if (typeof anyRes.status === 'function') {
      anyRes.status(204);
    }
    if (typeof anyRes.end === 'function') {
      anyRes.end();
    }
    return false;
  }
  if (method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return false;
  }
  return true;
}

function getGeminiApiKey(): string {
  const metaEnv =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      : undefined;
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    metaEnv?.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    '';
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

function createAiClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Nginx in AI Studio intercepts 403, 502, 503, and 504 with HTML pages (HTTP 200 warmup/forbidden).
// Always return safe JSON-preserving HTTP status codes from API routes.
function toSafeApiErrorStatus(status?: number): number {
  if (
    status === 400 ||
    status === 401 ||
    status === 404 ||
    status === 413 ||
    status === 422 ||
    status === 429
  ) {
    return status;
  }
  return 500;
}

function extractServerErrorText(err: unknown): string {
  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (trimmed && trimmed !== '[object Object]') return trimmed;
  }
  if (err && typeof err === 'object') {
    const record = err as {
      message?: unknown;
      error?: { message?: unknown } | unknown;
    };
    if (typeof record.message === 'string' && record.message.trim() && record.message !== '[object Object]') {
      return record.message.trim();
    }
    if (
      record.error &&
      typeof record.error === 'object' &&
      'message' in record.error &&
      typeof (record.error as { message?: unknown }).message === 'string'
    ) {
      const nested = ((record.error as { message: string }).message || '').trim();
      if (nested && nested !== '[object Object]') return nested;
    }
    if (typeof record.error === 'string' && record.error.trim() && record.error !== '[object Object]') {
      return record.error.trim();
    }
    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // Ignore serialization error
    }
  }
  return 'Unexpected error while calling AI service.';
}

function getUpstreamErrorInfo(err: unknown): {
  status: number;
  isTimeout: boolean;
  rawMessage: string;
} {
  const isTimeout =
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError');
  const rawStatus =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  const rawMessage = extractServerErrorText(err);
  return {
    status: toSafeApiErrorStatus(rawStatus),
    isTimeout,
    rawMessage,
  };
}

function isAuthOrKeyError(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  return (
    lower.includes('api_key') ||
    lower.includes('api key') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid authentication')
  );
}

function shouldRetryCandidate(err: unknown): boolean {
  const { status, isTimeout, rawMessage } = getUpstreamErrorInfo(err);
  if (isAuthOrKeyError(rawMessage)) {
    return false;
  }
  return status >= 500 || status === 429 || status === 404 || isTimeout;
}

function formatFriendlyAiError(
  err: unknown,
  fallbackMessage: string,
): {
  status: number;
  error: string;
} {
  const { status, isTimeout, rawMessage } = getUpstreamErrorInfo(err);
  const lower = rawMessage.toLowerCase();

  if (isTimeout) {
    return {
      status: 500,
      error:
        'Amsar AI ta dauki lokaci fiye da kima (timeout). Da fatan a sake gwadawa.',
    };
  }
  if (
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('"code":503')
  ) {
    return {
      status: 500,
      error:
        'Sabar AI tana da cunkoso na wucin-gadi a wannan dakika. Sake gwadawa bayan sakan kadan.',
    };
  }
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      error:
        'An kai iyakar tambayoyi na dan lokaci. Jira kadan sannan ka sake gwadawa.',
    };
  }
  if (isAuthOrKeyError(rawMessage)) {
    return {
      status: 400,
      error:
        'Makullin GEMINI_API_KEY bai yi aiki ba ko yana da takunkumi. Duba GEMINI_API_KEY a Vercel Environment Variables ko Settings > Secrets sannan ka sake turawa (Redeploy).',
    };
  }
  if (lower.includes('unable to process input') || lower.includes('invalid_argument')) {
    return {
      status: 400,
      error:
        'Ba a iya karanta wannan fayil din sauti ko sako ba. Sake rikodi ka gwada.',
    };
  }
  return {
    status,
    error: fallbackMessage,
  };
}

interface ThinkRequestBody {
  prompt?: unknown;
  context?: unknown;
  mode?: unknown;
  history?: unknown;
}

interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: HistoryTurn[] = [];
  for (const item of raw.slice(-10)) {
    if (
      item &&
      typeof item === 'object' &&
      'role' in item &&
      'text' in item &&
      (item.role === 'user' || item.role === 'model') &&
      typeof item.text === 'string' &&
      item.text.trim().length > 0
    ) {
      turns.push({
        role: item.role,
        text: item.text.trim().slice(0, 4000),
      });
    }
  }
  return turns;
}

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'getnada.com',
  'sharklasers.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'mintemail.com',
  'mohmal.com',
  'tempail.com',
  'emailondeck.com',
]);

const TRUSTED_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'zoho.com',
  'yandex.com',
]);

function getErrorCode(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string'
  ) {
    return (err as { code: string }).code;
  }
  return '';
}

async function checkDomainHasMailServer(domain: string): Promise<'ok' | 'missing' | 'timeout'> {
  if (TRUSTED_EMAIL_DOMAINS.has(domain)) {
    return 'ok';
  }

  const timeoutPromise = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), 3500),
  );

  const lookupPromise = (async (): Promise<'ok' | 'missing' | 'timeout'> => {
    try {
      const mx = await dns.resolveMx(domain);
      if (Array.isArray(mx) && mx.some((rec) => rec.exchange && rec.exchange.trim().length > 0)) {
        return 'ok';
      }
    } catch (err: unknown) {
      const code = getErrorCode(err);
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        return 'missing';
      }
      if (code !== 'ENODATA') {
        return 'timeout';
      }
    }

    try {
      const addrs = await dns.resolve4(domain);
      if (Array.isArray(addrs) && addrs.length > 0) {
        return 'ok';
      }
      return 'missing';
    } catch (err: unknown) {
      const code = getErrorCode(err);
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN' || code === 'ENODATA') {
        return 'missing';
      }
      return 'timeout';
    }
  })();

  return Promise.race([lookupPromise, timeoutPromise]);
}

const MISSING_KEY_MESSAGE =
  'GEMINI_API_KEY ba a saita shi ba. Saita GEMINI_API_KEY a Vercel Environment Variables ko Settings > Secrets sannan ka yi Redeploy.';

export async function handleVerifyEmailDomain(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!rawEmail || rawEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
    sendJson(res, 200, { valid: false, reason: 'invalid_format' });
    return;
  }

  const parts = rawEmail.split('@');
  const localPart = parts[0] || '';
  const domain = parts[1] || '';

  if (!localPart || !domain || domain.includes('..') || domain.startsWith('-') || domain.endsWith('-')) {
    sendJson(res, 200, { valid: false, reason: 'invalid_format' });
    return;
  }

  const typoSuggestion = COMMON_DOMAIN_TYPOS[domain];
  if (typoSuggestion) {
    sendJson(res, 200, {
      valid: false,
      reason: 'typo',
      suggestion: `${localPart}@${typoSuggestion}`,
    });
    return;
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    sendJson(res, 200, { valid: false, reason: 'disposable' });
    return;
  }

  const mxResult = await checkDomainHasMailServer(domain);
  if (mxResult === 'missing') {
    sendJson(res, 200, { valid: false, reason: 'no_mx', domain });
    return;
  }

  sendJson(res, 200, {
    valid: true,
    domain,
    mxVerified: mxResult === 'ok',
  });
}

export async function handleThink(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: ThinkRequestBody;
  try {
    body = (await readJsonBody(req)) as ThinkRequestBody;
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const context = typeof body.context === 'string' ? body.context.trim().slice(0, 2000) : '';
  const mode = typeof body.mode === 'string' ? body.mode : 'chat';
  const history = sanitizeHistory(body.history);

  if (!rawPrompt) {
    sendJson(res, 400, { error: 'Da fatan za a rubuta tambaya ko sako (Prompt is required).' });
    return;
  }

  if (rawPrompt.length > 4000) {
    sendJson(res, 400, { error: 'Tambayar ta yi tsayi sosai (maximum 4000 characters).' });
    return;
  }

  const ai = createAiClient();
  if (!ai) {
    sendJson(res, 500, { error: MISSING_KEY_MESSAGE });
    return;
  }

  let systemInstruction =
    'You are World Connection, a thoughtful, culturally fluent assistant built into the World Connection social platform. ' +
    'Your name is strictly World Connection. If asked your name or who you are, always say your name is World Connection (never mention Deep Think, Gemini, Google AI, or any underlying model name). ' +
    'You fluently understand both Hausa and English and respond naturally in whichever language the user writes in (or bilingual when helpful). ' +
    'Break down topics clearly, check logic carefully, and remain warm, concise, and practical.';

  if (mode === 'analyze_post') {
    systemInstruction =
      'You are World Connection analyzing a social community post. Provide a clear, thoughtful reflection, relevant context, or helpful takeaways in 2–3 concise paragraphs. Match the language of the post or query (Hausa or English), and never mention Gemini or underlying model names.';
  } else if (mode === 'draft_post') {
    systemInstruction =
      'You are World Connection helping a member write a clear, engaging, respectful community post for World Connection. Return only the polished post text ready to publish, matching the language requested (Hausa or English).';
  }

  const fullPrompt = context ? `Context:\n${context}\n\nRequest:\n${rawPrompt}` : rawPrompt;
  const selectedThinkingLevel =
    mode === 'analyze_post' ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW;

  try {
    const contents = [
      ...history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: fullPrompt }],
      },
    ];

    let response;
    let usedModel = 'gemini-2.5-flash';
    let lastErr: unknown;
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
    ] as const;

    for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
      const currentModel = candidateModels[attempt];
      const attemptTimeoutMs =
        currentModel === 'gemini-4-hydrogen'
          ? mode === 'analyze_post'
            ? 10000
            : 8000
          : 15000;
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config:
            currentModel === 'gemini-4-hydrogen'
              ? {
                  systemInstruction,
                  abortSignal: AbortSignal.timeout(attemptTimeoutMs),
                  thinkingConfig: {
                    thinkingLevel: selectedThinkingLevel,
                  },
                }
              : {
                  systemInstruction,
                  abortSignal: AbortSignal.timeout(attemptTimeoutMs),
                },
        });
        usedModel = currentModel;
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (attempt < candidateModels.length - 1 && shouldRetryCandidate(err)) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastErr ?? new Error('Unable to reach AI service.');
    }

    const answer = response.text?.trim();
    if (!answer) {
      sendJson(res, 500, {
        error: 'World Connection AI ba ta dawo da amsa ba. Sake gwadawa.',
      });
      return;
    }

    sendJson(res, 200, {
      answer,
      model: usedModel,
      thinkingLevel: mode === 'analyze_post' ? 'MEDIUM' : 'LOW',
    });
  } catch (err: unknown) {
    const { status, error } = formatFriendlyAiError(
      err,
      'Ba a iya samun amsa daga World Connection AI a halin yanzu ba. Sake gwadawa.',
    );
    sendJson(res, status, { error });
  }
}

export async function handleVerifyReceipt(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const amountText =
    typeof body.amountText === 'string' ? body.amountText.trim().slice(0, 60) : '';
  const referenceText =
    typeof body.referenceText === 'string' ? body.referenceText.trim().slice(0, 120) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const vipPriceLabel =
    typeof body.vipPriceLabel === 'string' ? body.vipPriceLabel.trim().slice(0, 60) : '';
  const vipPaymentInfo =
    typeof body.vipPaymentInfo === 'string' ? body.vipPaymentInfo.trim().slice(0, 500) : '';
  const channelName =
    typeof body.channelName === 'string' ? body.channelName.trim().slice(0, 80) : '';
  const receiptImage =
    typeof body.receiptImage === 'string' ? body.receiptImage.trim() : '';

  if (!amountText && !receiptImage) {
    sendJson(res, 400, {
      error: 'Da fatan za a rubuta adadin kuɗi ko a saka hoton rasit.',
    });
    return;
  }

  let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;
  if (receiptImage) {
    if (receiptImage.length > 380000) {
      sendJson(res, 400, {
        error: 'Hoton rasit ya yi girma sosai. Gwada ƙaramin hoto.',
      });
      return;
    }
    const match = receiptImage.match(
      /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match) {
      sendJson(res, 400, {
        error: 'Hoton rasit bai dace ba (JPEG, PNG, ko WebP kaɗai).',
      });
      return;
    }
    imagePart = {
      inlineData: {
        mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
        data: match[2],
      },
    };
  }

  const ai = createAiClient();
  if (!ai) {
    sendJson(res, 500, {
      error: 'Receipt verification service is temporarily unavailable.',
    });
    return;
  }

  const promptText = [
    'You are verifying a VIP channel subscription payment receipt on World Connection.',
    `Channel Name: ${channelName || 'VIP Channel'}`,
    `Expected Price: ${vipPriceLabel || 'Not specified'}`,
    `Expected Payment Instructions / Account: ${vipPaymentInfo || 'Not specified'}`,
    `Subscriber Claimed Amount: ${amountText || 'Not provided'}`,
    `Subscriber Transfer Reference / Sender Name: ${referenceText || 'Not provided'}`,
    `Subscriber Note: ${note || 'None'}`,
    imagePart
      ? 'Carefully inspect the attached payment receipt image (Nigerian bank/OPay/PalmPay/Moniepoint/Paystack/card receipt) and extract the visible amount, reference/session ID, date/time, recipient account/name, and transaction status.'
      : 'No receipt screenshot was attached; evaluate only the text details and set verdict to "review" since visual proof is missing.',
    'Return strict JSON:',
    '- verdict: "match" if the receipt shows Successful/Completed payment matching expected price and recipient details; "mismatch" if failed/reversed/wrong amount/clearly fake; otherwise "review".',
    '- extractedAmount, extractedReference, extractedDate: concise strings (or "Ba a gani ba" if unreadable).',
    '- summaryHa: 1-2 short sentences in natural Hausa explaining what was detected on the receipt and whether the creator should confirm bank alert.',
    '- summaryEn: 1-2 short sentences in English explaining the same.',
  ].join('\n');

  const contents = [
    {
      role: 'user' as const,
      parts: imagePart ? [imagePart, { text: promptText }] : [{ text: promptText }],
    },
  ];

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      verdict: {
        type: Type.STRING,
        enum: ['match', 'review', 'mismatch'],
      },
      extractedAmount: { type: Type.STRING },
      extractedReference: { type: Type.STRING },
      extractedDate: { type: Type.STRING },
      summaryHa: { type: Type.STRING },
      summaryEn: { type: Type.STRING },
    },
    required: [
      'verdict',
      'extractedAmount',
      'extractedReference',
      'extractedDate',
      'summaryHa',
      'summaryEn',
    ],
  };

  try {
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
    ] as const;
    let response;
    let lastErr: unknown;

    for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
      const currentModel = candidateModels[attempt];
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config:
            currentModel === 'gemini-4-hydrogen'
              ? {
                  responseMimeType: 'application/json',
                  responseSchema,
                  abortSignal: AbortSignal.timeout(12000),
                  thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                  },
                }
              : {
                  responseMimeType: 'application/json',
                  responseSchema,
                  abortSignal: AbortSignal.timeout(15000),
                },
        });
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (attempt < candidateModels.length - 1 && shouldRetryCandidate(err)) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    if (!response?.text) {
      throw lastErr ?? new Error('Empty verification response');
    }

    const parsed = JSON.parse(response.text) as {
      verdict?: unknown;
      extractedAmount?: unknown;
      extractedReference?: unknown;
      extractedDate?: unknown;
      summaryHa?: unknown;
      summaryEn?: unknown;
    };

    const verdict =
      parsed.verdict === 'match' ||
      parsed.verdict === 'mismatch' ||
      parsed.verdict === 'review'
        ? parsed.verdict
        : 'review';

    sendJson(res, 200, {
      verdict,
      extractedAmount:
        typeof parsed.extractedAmount === 'string'
          ? parsed.extractedAmount.slice(0, 80)
          : '',
      extractedReference:
        typeof parsed.extractedReference === 'string'
          ? parsed.extractedReference.slice(0, 120)
          : '',
      extractedDate:
        typeof parsed.extractedDate === 'string'
          ? parsed.extractedDate.slice(0, 80)
          : '',
      summaryHa:
        typeof parsed.summaryHa === 'string'
          ? parsed.summaryHa.slice(0, 500)
          : 'An duba rasit; mai channel ya tabbatar da alert kafin buɗewa.',
      summaryEn:
        typeof parsed.summaryEn === 'string'
          ? parsed.summaryEn.slice(0, 500)
          : 'Receipt screened; creator should confirm bank alert before unlocking.',
    });
  } catch (err: unknown) {
    const { status, error } = formatFriendlyAiError(
      err,
      'Unable to screen receipt right now.',
    );
    sendJson(res, status, { error });
  }
}

export async function handleTranslate(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  const targetLanguage =
    body.targetLanguage === 'Hausa' ||
    body.targetLanguage === 'English' ||
    body.targetLanguage === 'Arabic' ||
    body.targetLanguage === 'French'
      ? body.targetLanguage
      : null;

  if (!rawText) {
    sendJson(res, 400, { error: 'Message text is required for translation.' });
    return;
  }
  if (rawText.length > 4000) {
    sendJson(res, 400, { error: 'Message exceeds maximum length (4000 chars).' });
    return;
  }
  if (!targetLanguage) {
    sendJson(res, 400, {
      error: 'Target language must be Hausa, English, Arabic, or French.',
    });
    return;
  }

  const ai = createAiClient();
  if (!ai) {
    sendJson(res, 500, { error: MISSING_KEY_MESSAGE });
    return;
  }

  const systemInstruction =
    'You are a precise, culturally fluent translator for World Connection. ' +
    'Translate the user message accurately and naturally between Hausa, English, Arabic, and French. ' +
    'Preserve names, numbers, links, and emojis. Return ONLY the translated text with no explanation, quotes, or prefixes.';

  const promptText = `Translate the following message into ${targetLanguage}:\n\n${rawText}`;

  try {
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
    ] as const;
    let response;
    let lastErr: unknown;

    for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
      const currentModel = candidateModels[attempt];
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents: promptText,
          config:
            currentModel === 'gemini-4-hydrogen'
              ? {
                  systemInstruction,
                  abortSignal: AbortSignal.timeout(10000),
                  thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                  },
                }
              : {
                  systemInstruction,
                  abortSignal: AbortSignal.timeout(12000),
                },
        });
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (attempt < candidateModels.length - 1 && shouldRetryCandidate(err)) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    const translatedText = response?.text?.trim();
    if (!translatedText) {
      throw lastErr ?? new Error('No translation returned from AI service.');
    }

    sendJson(res, 200, {
      translatedText,
      targetLanguage,
    });
  } catch (err: unknown) {
    const { status, error } = formatFriendlyAiError(
      err,
      'Unable to translate message right now.',
    );
    sendJson(res, status, { error });
  }
}

export async function handleTranscribe(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const audioData = typeof body.audioData === 'string' ? body.audioData.trim() : '';

  if (!audioData) {
    sendJson(res, 400, { error: 'Audio data is required for transcription.' });
    return;
  }
  if (audioData.length > 1000000) {
    sendJson(res, 400, { error: 'Audio clip exceeds size limit for transcription.' });
    return;
  }

  const match = audioData.match(
    /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\s]+)$/i,
  );
  if (!match) {
    sendJson(res, 400, { error: 'Unsupported voice message audio format.' });
    return;
  }

  let mimeType = match[1].toLowerCase();
  if (mimeType === 'audio/m4a' || mimeType === 'audio/x-m4a') {
    mimeType = 'audio/mp4';
  }
  const base64AudioString = match[2].replace(/\s+/g, '');

  const aiDefault = createAiClient();
  const aiBeta = createAiClient('v1beta');
  if (!aiDefault || !aiBeta) {
    sendJson(res, 500, { error: MISSING_KEY_MESSAGE });
    return;
  }

  const audioPart = {
    inlineData: {
      mimeType,
      data: base64AudioString,
    },
  };
  const transcribePrompt =
    'Transcribe this voice message accurately in its original spoken language (such as Hausa, English, Arabic, or French). Return only the spoken words as plain text.';

  const attempts: Array<{
    client: GoogleGenAI;
    model: string;
    useThinkingLow: boolean;
    timeoutMs: number;
  }> = [
    { client: aiDefault, model: 'gemini-2.5-flash', useThinkingLow: false, timeoutMs: 14000 },
    { client: aiBeta, model: 'gemini-3.5-transcribe', useThinkingLow: false, timeoutMs: 12000 },
    { client: aiDefault, model: 'gemini-4-hydrogen', useThinkingLow: true, timeoutMs: 12000 },
    { client: aiDefault, model: 'gemini-3.1-flash-lite', useThinkingLow: false, timeoutMs: 12000 },
  ];

  try {
    let response;
    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i += 1) {
      const current = attempts[i];
      try {
        response = await current.client.models.generateContent({
          model: current.model,
          contents: {
            parts: [audioPart, { text: transcribePrompt }],
          },
          config: current.useThinkingLow
            ? {
                abortSignal: AbortSignal.timeout(current.timeoutMs),
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              }
            : {
                abortSignal: AbortSignal.timeout(current.timeoutMs),
              },
        });
        if (response?.text?.trim()) {
          break;
        }
      } catch (err: unknown) {
        lastErr = err;
        if (i < attempts.length - 1 && shouldRetryCandidate(err)) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    const transcript = response?.text?.trim();
    if (!transcript) {
      throw lastErr ?? new Error('No speech transcript was detected.');
    }

    sendJson(res, 200, { transcript });
  } catch (err: unknown) {
    const { status, error } = formatFriendlyAiError(
      err,
      'Ba a iya fassara wannan sakon murya zuwa rubutu a yanzu ba. Sake gwadawa.',
    );
    sendJson(res, status, { error });
  }
}

export async function handleSummarizeChat(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const roomName =
    typeof body.roomName === 'string'
      ? body.roomName.trim().slice(0, 80)
      : 'Conversation';
  const roomType = body.roomType === 'channel' ? 'channel' : 'group';
  const uiLanguage = body.uiLanguage === 'ha' ? 'Hausa' : 'English';
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];

  const cleanMessages = rawMessages
    .slice(-40)
    .filter(
      (m): m is { senderName?: unknown; text?: unknown; timestamp?: unknown } =>
        typeof m === 'object' && m !== null && 'text' in m,
    )
    .map((m) => ({
      senderName:
        typeof m.senderName === 'string' && m.senderName.trim()
          ? m.senderName.trim().slice(0, 50)
          : 'Member',
      text: typeof m.text === 'string' ? m.text.trim().slice(0, 800) : '',
      timestamp:
        typeof m.timestamp === 'string' ? m.timestamp.trim().slice(0, 20) : '',
    }))
    .filter((m) => m.text.length > 0);

  if (cleanMessages.length === 0) {
    sendJson(res, 400, { error: 'There are no messages to summarize yet.' });
    return;
  }

  const ai = createAiClient();
  if (!ai) {
    sendJson(res, 500, { error: MISSING_KEY_MESSAGE });
    return;
  }

  const transcriptBlock = cleanMessages
    .map((m) =>
      m.timestamp
        ? `[${m.timestamp}] ${m.senderName}: ${m.text}`
        : `${m.senderName}: ${m.text}`,
    )
    .join('\n');

  const systemInstruction =
    `You are World Connection summarizing recent messages in a ${roomType} named "${roomName}". ` +
    `Write a concise, well-organized summary in ${uiLanguage} highlighting the main topics, key announcements or decisions, and important takeaways using short bullet points. ` +
    'Keep it brief, accurate, and grounded strictly in the provided messages.';

  try {
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
    ] as const;
    let response;
    let lastErr: unknown;

    for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
      const currentModel = candidateModels[attempt];
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents: `Summarize these ${cleanMessages.length} recent messages:\n\n${transcriptBlock}`,
          config:
            currentModel === 'gemini-4-hydrogen'
              ? {
                  systemInstruction,
                  abortSignal: AbortSignal.timeout(10000),
                  thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                  },
                }
              : {
                  systemInstruction,
                  abortSignal: AbortSignal.timeout(12000),
                },
        });
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (attempt < candidateModels.length - 1 && shouldRetryCandidate(err)) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    const summary = response?.text?.trim();
    if (!summary) {
      throw lastErr ?? new Error('Unable to generate summary.');
    }

    sendJson(res, 200, {
      summary,
      messageCount: cleanMessages.length,
    });
  } catch (err: unknown) {
    const { status, error } = formatFriendlyAiError(
      err,
      'Unable to summarize chat right now.',
    );
    sendJson(res, status, { error });
  }
}

export async function handleShortenLink(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  if (!ensurePostMethod(req, res)) return;
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const info = getUpstreamErrorInfo(err);
    sendJson(res, info.status, { error: info.rawMessage });
    return;
  }

  const kind = body.kind === 'group' || body.kind === 'channel' ? body.kind : null;
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';

  if (!kind || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId)) {
    sendJson(res, 400, { error: 'Invalid group or channel invite parameters.' });
    return;
  }

  const rawForwardedHost = req.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(rawForwardedHost)
    ? rawForwardedHost[0]
    : rawForwardedHost;
  const rawHostHeader = req.headers.host;
  const hostHeader = Array.isArray(rawHostHeader) ? rawHostHeader[0] : rawHostHeader;
  const reqHost = (forwardedHost || hostHeader || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  let appUrlHost = '';
  let appUrlOrigin = '';
  if (process.env.APP_URL) {
    try {
      const parsedApp = new URL(process.env.APP_URL);
      appUrlHost = parsedApp.host.toLowerCase();
      appUrlOrigin = parsedApp.origin;
    } catch {
      // Ignore invalid APP_URL
    }
  }

  let trustedOrigin = appUrlOrigin || (reqHost ? `https://${reqHost}` : '');
  if (typeof body.origin === 'string' && body.origin.trim()) {
    try {
      const parsedOrigin = new URL(body.origin.trim());
      const isLocalHost =
        parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1';
      const allowedProtocol =
        parsedOrigin.protocol === 'https:' ||
        (isLocalHost && parsedOrigin.protocol === 'http:');
      const originHost = parsedOrigin.host.toLowerCase();
      if (
        allowedProtocol &&
        ((reqHost && originHost === reqHost) || (appUrlHost && originHost === appUrlHost))
      ) {
        trustedOrigin = parsedOrigin.origin;
      }
    } catch {
      // Keep server-derived origin
    }
  }

  if (!trustedOrigin) {
    sendJson(res, 400, { error: 'Unable to determine application origin.' });
    return;
  }

  const prefix = kind === 'group' ? 'g' : 'c';
  const targetUrl = `${trustedOrigin}/${prefix}/${encodeURIComponent(roomId)}`;

  try {
    const tinyRes = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': 'WorldConnection/1.0' },
      },
    );
    if (tinyRes.ok) {
      const text = (await tinyRes.text()).trim();
      if (/^https:\/\/tinyurl\.com\/[a-zA-Z0-9_-]{3,40}$/.test(text)) {
        sendJson(res, 200, { shortUrl: text, targetUrl, shortened: true });
        return;
      }
    }
  } catch {
    // Fall through to secondary shortener
  }

  try {
    const isGdRes = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(targetUrl)}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': 'WorldConnection/1.0' },
      },
    );
    if (isGdRes.ok) {
      const text = (await isGdRes.text()).trim();
      if (/^https:\/\/is\.gd\/[a-zA-Z0-9_-]{3,40}$/.test(text)) {
        sendJson(res, 200, { shortUrl: text, targetUrl, shortened: true });
        return;
      }
    }
  } catch {
    // Fall back to direct short-path invite URL
  }

  sendJson(res, 200, { shortUrl: targetUrl, targetUrl, shortened: false });
}

interface DefaultYouTubeChannel {
  id: string;
  label: string;
}

const DEFAULT_YOUTUBE_CHANNELS: DefaultYouTubeChannel[] = [
  { id: 'UCZXbvNkOqOKGdaiV82_3zAQ', label: 'BBC News Hausa' },
  { id: 'UC8butISFwT-Wl7EV0hUK0BQ', label: 'freeCodeCamp' },
  { id: 'UCsooa4yRKGN_zEE8iknghZA', label: 'TED-Ed' },
  { id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', label: 'Google for Developers' },
];

const YOUTUBE_CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{20,28}$/;
const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}

function extractXmlTag(block: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : '';
}

interface ParsedYouTubeFeedItem {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string;
  description: string;
  source: 'rss';
}

function parseYouTubeRssXml(xml: string, fallbackLabel: string): ParsedYouTubeFeedItem[] {
  const feedChannelTitle = extractXmlTag(xml, 'title') || fallbackLabel;
  const feedChannelId = extractXmlTag(xml, 'yt:channelId');
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const items: ParsedYouTubeFeedItem[] = [];

  for (const entry of entries.slice(0, 12)) {
    const videoId = extractXmlTag(entry, 'yt:videoId');
    if (!YOUTUBE_VIDEO_ID_RE.test(videoId)) continue;

    const title = extractXmlTag(entry, 'title');
    if (!title) continue;

    const authorName = extractXmlTag(entry, 'name') || feedChannelTitle;
    const channelId = extractXmlTag(entry, 'yt:channelId') || feedChannelId;
    const publishedAt = extractXmlTag(entry, 'published') || extractXmlTag(entry, 'updated');
    const description = extractXmlTag(entry, 'media:description').slice(0, 260);
    const thumbMatch = entry.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    const rawThumb = thumbMatch ? decodeXmlEntities(thumbMatch[1]) : '';
    const thumbnailUrl = /^https:\/\/i[0-9]?\.ytimg\.com\//i.test(rawThumb)
      ? rawThumb
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    items.push({
      id: videoId,
      title,
      channelTitle: authorName,
      channelId,
      publishedAt,
      thumbnailUrl,
      description,
      source: 'rss',
    });
  }

  return items;
}

async function fetchSingleYouTubeRssChannel(
  channelId: string,
  fallbackLabel: string,
): Promise<ParsedYouTubeFeedItem[]> {
  if (!YOUTUBE_CHANNEL_ID_RE.test(channelId)) {
    return [];
  }
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(rssUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(7000),
    headers: {
      'User-Agent': 'WorldConnection/1.0',
      Accept: 'application/atom+xml, application/xml, text/xml',
    },
  });
  if (!res.ok) {
    throw new Error(`RSS feed returned HTTP ${res.status}`);
  }
  const xml = await res.text();
  return parseYouTubeRssXml(xml, fallbackLabel);
}

function getServerYouTubeApiKey(): string {
  const raw =
    process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || '';
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

function cleanYouTubeApiErrorMessage(raw: unknown, statusCode: number): string {
  let msg = '';
  if (raw && typeof raw === 'object') {
    const record = raw as {
      error?: { message?: unknown; errors?: Array<{ message?: unknown }> } | unknown;
      message?: unknown;
    };
    if (
      record.error &&
      typeof record.error === 'object' &&
      'message' in record.error &&
      typeof (record.error as { message?: unknown }).message === 'string'
    ) {
      msg = (record.error as { message: string }).message;
    } else if (typeof record.message === 'string') {
      msg = record.message;
    }
  } else if (typeof raw === 'string') {
    msg = raw;
  }

  const plain = decodeXmlEntities(msg.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (plain) {
    return plain.length > 220 ? `${plain.slice(0, 220)}...` : plain;
  }
  return `YouTube API returned HTTP ${statusCode}.`;
}

export async function handleYouTube(
  req: ApiRequestLike | IncomingMessage,
  res: ApiResponseLike | ServerResponse,
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    const anyRes = res as ApiResponseLike;
    anyRes.statusCode = 204;
    if (typeof anyRes.status === 'function') {
      anyRes.status(204);
    }
    if (typeof anyRes.end === 'function') {
      anyRes.end();
    }
    return;
  }
  if (method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed. Use GET.' });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.url || '/api/youtube', 'https://localhost');
  } catch {
    sendJson(res, 400, { error: 'Invalid request URL.' });
    return;
  }

  const rawChannelId = (parsedUrl.searchParams.get('channelId') || '').trim();
  const rawQuery = (parsedUrl.searchParams.get('q') || '').trim().slice(0, 120);

  if (rawChannelId && !YOUTUBE_CHANNEL_ID_RE.test(rawChannelId)) {
    sendJson(res, 400, {
      error: 'Invalid YouTube Channel ID format. Expected an ID starting with "UC".',
    });
    return;
  }

  // Full YouTube search via YouTube Data API v3 when a search query is provided (without channelId)
  if (rawQuery && !rawChannelId) {
    const apiKey = getServerYouTubeApiKey();
    if (!apiKey) {
      sendJson(res, 400, {
        error:
          'YouTube search requires YOUTUBE_API_KEY or VITE_YOUTUBE_API_KEY in Vercel Environment Variables.',
      });
      return;
    }

    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
        part: 'snippet',
        type: 'video',
        videoEmbeddable: 'true',
        safeSearch: 'moderate',
        maxResults: '12',
        q: rawQuery,
        key: apiKey,
      }).toString()}`;

      const apiRes = await fetch(searchUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(9000),
      });
      const apiData = (await apiRes.json().catch(() => ({}))) as {
        items?: Array<{
          id?: string | { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            channelId?: string;
            publishedAt?: string;
            description?: string;
            thumbnails?: {
              high?: { url?: string };
              medium?: { url?: string };
              default?: { url?: string };
            };
          };
        }>;
        error?: unknown;
      };

      if (!apiRes.ok) {
        const shortErr = cleanYouTubeApiErrorMessage(apiData, apiRes.status);
        const safeStatus = apiRes.status === 403 ? 400 : toSafeApiErrorStatus(apiRes.status);
        sendJson(res, safeStatus, { error: shortErr });
        return;
      }

      const videos: Array<Omit<ParsedYouTubeFeedItem, 'source'> & { source: 'api' }> = [];
      for (const item of apiData.items || []) {
        const videoId =
          typeof item.id === 'string' ? item.id : item.id?.videoId || '';
        const title = item.snippet?.title ? decodeXmlEntities(item.snippet.title) : '';
        if (!YOUTUBE_VIDEO_ID_RE.test(videoId) || !title) continue;

        const thumb =
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        videos.push({
          id: videoId,
          title,
          channelTitle: decodeXmlEntities(item.snippet?.channelTitle || 'YouTube'),
          channelId: item.snippet?.channelId || '',
          publishedAt: item.snippet?.publishedAt || '',
          thumbnailUrl: thumb,
          description: decodeXmlEntities(item.snippet?.description || '').slice(0, 260),
          source: 'api',
        });
      }

      const anyRes = res as ApiResponseLike;
      if (typeof anyRes.setHeader === 'function') {
        anyRes.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
      }

      sendJson(res, 200, {
        videos,
        channels: DEFAULT_YOUTUBE_CHANNELS,
        source: 'api',
      });
      return;
    } catch (err) {
      sendJson(res, 500, {
        error: cleanYouTubeApiErrorMessage(err, 500),
      });
      return;
    }
  }

  const targets: DefaultYouTubeChannel[] = rawChannelId
    ? [{ id: rawChannelId, label: rawChannelId }]
    : DEFAULT_YOUTUBE_CHANNELS;

  const settled = await Promise.allSettled(
    targets.map((ch) => fetchSingleYouTubeRssChannel(ch.id, ch.label)),
  );

  const seenIds = new Set<string>();
  const collected: ParsedYouTubeFeedItem[] = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    for (const item of outcome.value) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      collected.push(item);
    }
  }

  collected.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0;
    return tb - ta;
  });

  const anyRes = res as ApiResponseLike;
  if (typeof anyRes.setHeader === 'function') {
    anyRes.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
  }

  sendJson(res, 200, {
    videos: collected.slice(0, 24),
    channels: DEFAULT_YOUTUBE_CHANNELS,
    source: 'rss',
  });
}
