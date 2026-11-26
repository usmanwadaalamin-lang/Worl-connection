import 'dotenv/config';
import dns from 'dns/promises';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function createAiClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
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
// Always return safe JSON-preserving HTTP status codes from Express API routes.
function toSafeApiErrorStatus(status?: number): number {
  if (status === 400 || status === 401 || status === 404 || status === 422 || status === 429) {
    return status;
  }
  return 500;
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
      : isTimeout
        ? 500
        : 500;
  const rawMessage =
    err instanceof Error ? err.message : 'Unexpected error while calling AI service.';
  return {
    status: toSafeApiErrorStatus(rawStatus),
    isTimeout,
    rawMessage,
  };
}

function formatFriendlyAiError(err: unknown, fallbackMessage: string): {
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
  if (lower.includes('api_key') || lower.includes('permission_denied')) {
    return {
      status: 500,
      error:
        'Da fatan za a duba GEMINI_API_KEY a Settings > Secrets panel.',
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
        // Transient DNS failures (ETIMEOUT, EAI_AGAIN, ESERVFAIL, ECONNREFUSED) should not block valid users.
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/verify-email-domain', async (req, res) => {
    const rawEmail =
      req.body && typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (!rawEmail || rawEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
      res.json({ valid: false, reason: 'invalid_format' });
      return;
    }

    const parts = rawEmail.split('@');
    const localPart = parts[0] || '';
    const domain = parts[1] || '';

    if (!localPart || !domain || domain.includes('..') || domain.startsWith('-') || domain.endsWith('-')) {
      res.json({ valid: false, reason: 'invalid_format' });
      return;
    }

    const typoSuggestion = COMMON_DOMAIN_TYPOS[domain];
    if (typoSuggestion) {
      res.json({
        valid: false,
        reason: 'typo',
        suggestion: `${localPart}@${typoSuggestion}`,
      });
      return;
    }

    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      res.json({ valid: false, reason: 'disposable' });
      return;
    }

    const mxResult = await checkDomainHasMailServer(domain);
    if (mxResult === 'missing') {
      res.json({ valid: false, reason: 'no_mx', domain });
      return;
    }

    res.json({
      valid: true,
      domain,
      mxVerified: mxResult === 'ok',
    });
  });

  app.post('/api/think', async (req, res) => {
    const body = (req.body || {}) as ThinkRequestBody;
    const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const context = typeof body.context === 'string' ? body.context.trim().slice(0, 2000) : '';
    const mode = typeof body.mode === 'string' ? body.mode : 'chat';
    const history = sanitizeHistory(body.history);

    if (!rawPrompt) {
      res.status(400).json({ error: 'Da fatan za a rubuta tambaya ko sako (Prompt is required).' });
      return;
    }

    if (rawPrompt.length > 4000) {
      res.status(400).json({ error: 'Tambayar ta yi tsayi sosai (maximum 4000 characters).' });
      return;
    }

    const ai = createAiClient();
    if (!ai) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.',
      });
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

    const fullPrompt = context
      ? `Context:\n${context}\n\nRequest:\n${rawPrompt}`
      : rawPrompt;

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
      let usedModel = 'gemini-4-hydrogen';
      let lastErr: unknown;
      const candidateModels = [
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite',
      ] as const;

      for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
        const currentModel = candidateModels[attempt];
        const attemptTimeoutMs =
          currentModel === 'gemini-3.1-flash-lite'
            ? 20000
            : mode === 'analyze_post'
              ? 12000
              : 8000;
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config:
              currentModel === 'gemini-3.1-flash-lite'
                ? {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(attemptTimeoutMs),
                  }
                : {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(attemptTimeoutMs),
                    thinkingConfig: {
                      thinkingLevel: selectedThinkingLevel,
                    },
                  },
          });
          usedModel = currentModel;
          break;
        } catch (err: unknown) {
          lastErr = err;
          const status =
            typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status?: unknown }).status === 'number'
              ? (err as { status: number }).status
              : 500;
          const isTimeout =
            err instanceof Error &&
            (err.name === 'AbortError' || err.name === 'TimeoutError');
          if (
            attempt < candidateModels.length - 1 &&
            (status >= 500 || status === 429 || isTimeout)
          ) {
            await new Promise((r) => setTimeout(r, 400));
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
        res.status(500).json({ error: 'World Connection AI ba ta dawo da amsa ba. Sake gwadawa.' });
        return;
      }

      res.json({
        answer,
        model: usedModel,
        thinkingLevel: mode === 'analyze_post' ? 'MEDIUM' : 'LOW',
      });
    } catch (err: unknown) {
      const { status, error } = formatFriendlyAiError(
        err,
        'Ba a iya samun amsa daga World Connection AI a halin yanzu ba. Sake gwadawa.',
      );
      res.status(status).json({ error });
    }
  });

  app.post('/api/verify-receipt', async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const amountText =
      typeof body.amountText === 'string' ? body.amountText.trim().slice(0, 60) : '';
    const referenceText =
      typeof body.referenceText === 'string' ? body.referenceText.trim().slice(0, 120) : '';
    const note =
      typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    const vipPriceLabel =
      typeof body.vipPriceLabel === 'string' ? body.vipPriceLabel.trim().slice(0, 60) : '';
    const vipPaymentInfo =
      typeof body.vipPaymentInfo === 'string' ? body.vipPaymentInfo.trim().slice(0, 500) : '';
    const channelName =
      typeof body.channelName === 'string' ? body.channelName.trim().slice(0, 80) : '';
    const receiptImage =
      typeof body.receiptImage === 'string' ? body.receiptImage.trim() : '';

    if (!amountText && !receiptImage) {
      res.status(400).json({
        error: 'Da fatan za a rubuta adadin kuɗi ko a saka hoton rasit.',
      });
      return;
    }

    let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;
    if (receiptImage) {
      if (receiptImage.length > 380000) {
        res.status(400).json({
          error: 'Hoton rasit ya yi girma sosai. Gwada ƙaramin hoto.',
        });
        return;
      }
      const match = receiptImage.match(
        /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!match) {
        res.status(400).json({
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
      res.status(500).json({
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
        parts: imagePart
          ? [imagePart, { text: promptText }]
          : [{ text: promptText }],
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
      const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
      let response;
      let lastErr: unknown;

      for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
        const currentModel = candidateModels[attempt];
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config:
              currentModel === 'gemini-3.1-flash-lite'
                ? {
                    responseMimeType: 'application/json',
                    responseSchema,
                    abortSignal: AbortSignal.timeout(15000),
                  }
                : {
                    responseMimeType: 'application/json',
                    responseSchema,
                    abortSignal: AbortSignal.timeout(12000),
                    thinkingConfig: {
                      thinkingLevel: ThinkingLevel.LOW,
                    },
                  },
          });
          break;
        } catch (err: unknown) {
          lastErr = err;
          if (attempt < candidateModels.length - 1) {
            await new Promise((r) => setTimeout(r, 350));
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

      res.json({
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
      res.status(status).json({ error });
    }
  });

  app.post('/api/translate', async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    const targetLanguage =
      body.targetLanguage === 'Hausa' ||
      body.targetLanguage === 'English' ||
      body.targetLanguage === 'Arabic' ||
      body.targetLanguage === 'French'
        ? body.targetLanguage
        : null;

    if (!rawText) {
      res.status(400).json({ error: 'Message text is required for translation.' });
      return;
    }
    if (rawText.length > 4000) {
      res.status(400).json({ error: 'Message exceeds maximum length (4000 chars).' });
      return;
    }
    if (!targetLanguage) {
      res.status(400).json({
        error: 'Target language must be Hausa, English, Arabic, or French.',
      });
      return;
    }

    const ai = createAiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.',
      });
      return;
    }

    const systemInstruction =
      'You are a precise, culturally fluent translator for World Connection. ' +
      'Translate the user message accurately and naturally between Hausa, English, Arabic, and French. ' +
      'Preserve names, numbers, links, and emojis. Return ONLY the translated text with no explanation, quotes, or prefixes.';

    const promptText = `Translate the following message into ${targetLanguage}:\n\n${rawText}`;

    try {
      const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
      let response;
      let lastErr: unknown;

      for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
        const currentModel = candidateModels[attempt];
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: promptText,
            config:
              currentModel === 'gemini-3.1-flash-lite'
                ? {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(12000),
                  }
                : {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(11000),
                    thinkingConfig: {
                      thinkingLevel: ThinkingLevel.LOW,
                    },
                  },
          });
          break;
        } catch (err: unknown) {
          lastErr = err;
          if (attempt < candidateModels.length - 1) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          throw err;
        }
      }

      const translatedText = response?.text?.trim();
      if (!translatedText) {
        throw lastErr ?? new Error('No translation returned from AI service.');
      }

      res.json({
        translatedText,
        targetLanguage,
      });
    } catch (err: unknown) {
      const { status, error } = formatFriendlyAiError(
        err,
        'Unable to translate message right now.',
      );
      res.status(status).json({ error });
    }
  });

  app.post('/api/transcribe', async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const audioData =
      typeof body.audioData === 'string' ? body.audioData.trim() : '';

    if (!audioData) {
      res.status(400).json({ error: 'Audio data is required for transcription.' });
      return;
    }
    if (audioData.length > 1000000) {
      res.status(400).json({ error: 'Audio clip exceeds size limit for transcription.' });
      return;
    }

    const match = audioData.match(
      /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\s]+)$/i,
    );
    if (!match) {
      res.status(400).json({ error: 'Unsupported voice message audio format.' });
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
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.',
      });
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
      { client: aiBeta, model: 'gemini-3.5-transcribe', useThinkingLow: false, timeoutMs: 14000 },
      { client: aiDefault, model: 'gemini-4-hydrogen', useThinkingLow: true, timeoutMs: 14000 },
      { client: aiDefault, model: 'gemini-3.1-flash-lite', useThinkingLow: false, timeoutMs: 14000 },
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
          if (i < attempts.length - 1) {
            await new Promise((r) => setTimeout(r, 450));
            continue;
          }
          throw err;
        }
      }

      const transcript = response?.text?.trim();
      if (!transcript) {
        throw lastErr ?? new Error('No speech transcript was detected.');
      }

      res.json({ transcript });
    } catch (err: unknown) {
      const { status, error } = formatFriendlyAiError(
        err,
        'Ba a iya fassara wannan sakon murya zuwa rubutu a yanzu ba. Sake gwadawa.',
      );
      res.status(status).json({ error });
    }
  });

  app.post('/api/summarize-chat', async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
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
        text:
          typeof m.text === 'string' ? m.text.trim().slice(0, 800) : '',
        timestamp:
          typeof m.timestamp === 'string' ? m.timestamp.trim().slice(0, 20) : '',
      }))
      .filter((m) => m.text.length > 0);

    if (cleanMessages.length === 0) {
      res.status(400).json({ error: 'There are no messages to summarize yet.' });
      return;
    }

    const ai = createAiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel.',
      });
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
      const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
      let response;
      let lastErr: unknown;

      for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
        const currentModel = candidateModels[attempt];
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: `Summarize these ${cleanMessages.length} recent messages:\n\n${transcriptBlock}`,
            config:
              currentModel === 'gemini-3.1-flash-lite'
                ? {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(12000),
                  }
                : {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(11000),
                    thinkingConfig: {
                      thinkingLevel: ThinkingLevel.LOW,
                    },
                  },
          });
          break;
        } catch (err: unknown) {
          lastErr = err;
          if (attempt < candidateModels.length - 1) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          throw err;
        }
      }

      const summary = response?.text?.trim();
      if (!summary) {
        throw lastErr ?? new Error('Unable to generate summary.');
      }

      res.json({
        summary,
        messageCount: cleanMessages.length,
      });
    } catch (err: unknown) {
      const { status, error } = formatFriendlyAiError(
        err,
        'Unable to summarize chat right now.',
      );
      res.status(status).json({ error });
    }
  });

  app.post('/api/shorten-link', async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const kind =
      body.kind === 'group' || body.kind === 'channel' ? body.kind : null;
    const roomId =
      typeof body.roomId === 'string' ? body.roomId.trim() : '';

    if (!kind || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId)) {
      res.status(400).json({ error: 'Invalid group or channel invite parameters.' });
      return;
    }

    const rawForwardedHost = req.headers['x-forwarded-host'];
    const forwardedHost = Array.isArray(rawForwardedHost)
      ? rawForwardedHost[0]
      : rawForwardedHost;
    const reqHost = (forwardedHost || req.headers.host || '')
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
          ((reqHost && originHost === reqHost) ||
            (appUrlHost && originHost === appUrlHost))
        ) {
          trustedOrigin = parsedOrigin.origin;
        }
      } catch {
        // Keep server-derived origin
      }
    }

    if (!trustedOrigin) {
      res.status(400).json({ error: 'Unable to determine application origin.' });
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
          res.json({ shortUrl: text, targetUrl, shortened: true });
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
          res.json({ shortUrl: text, targetUrl, shortened: true });
          return;
        }
      }
    } catch {
      // Fall back to direct short-path invite URL
    }

    res.json({ shortUrl: targetUrl, targetUrl, shortened: false });
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`World Connection server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
