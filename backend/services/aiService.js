const { interviewerPrompt, evaluationPrompt } = require('../utils/prompts');

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModelName = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const appUrl = process.env.OPENROUTER_APP_URL || 'http://localhost:3000';
const appName = process.env.OPENROUTER_APP_NAME || 'AI Tutor Screener';

if (!openRouterApiKey) {
  throw new Error('OPENROUTER_API_KEY is required in backend/.env');
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, context = 'request') {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable = error?.status === 429 || error?.status === 503 || error?.status >= 500;
      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function wrapAiError(error) {
  const status = error?.status || 500;
  const wrappedError = new Error('OpenRouter request failed.');

  wrappedError.status = status;
  wrappedError.code = error?.code || 'OPENROUTER_API_ERROR';
  wrappedError.details = error?.details || [];

  if (status === 429) {
    wrappedError.message = 'OpenRouter rate limit or quota exceeded. Please try again shortly or check your OpenRouter credits.';
  } else if (status === 401 || status === 403) {
    wrappedError.message = 'OpenRouter access was denied. Check the API key, model access, and account credits.';
  } else if (status === 400) {
    wrappedError.message = 'OpenRouter rejected the request payload. Please review the prompt or model configuration.';
  } else if (error?.message) {
    wrappedError.message = error.message;
  }

  return wrappedError;
}

async function callOpenRouter(messages, options = {}) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': appName,
    },
    body: JSON.stringify({
      model: openRouterModelName,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: options.responseFormat,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || 'OpenRouter request failed.');
    error.status = response.status;
    error.code = 'OPENROUTER_API_ERROR';
    error.details = payload?.error ? [payload.error] : [];
    throw error;
  }

  return payload?.choices?.[0]?.message?.content?.trim() || '';
}

async function chatResponse(message, history) {
  return withRetry(async () => {
    const messages = [
      { role: 'system', content: interviewerPrompt },
      ...history.map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      })),
      { role: 'user', content: message },
    ];

    const reply = await callOpenRouter(messages, {
      temperature: 0.8,
      maxTokens: 250,
    });

    return reply || 'I could not generate a response.';
  }, 'chat');
}

async function evaluateTranscript(transcript) {
  return withRetry(async () => {
    const raw = await callOpenRouter([
      { role: 'system', content: evaluationPrompt },
      { role: 'user', content: `Transcript:\n${transcript}` },
    ], {
      temperature: 0.2,
      maxTokens: 500,
      responseFormat: { type: 'json_object' },
    });

    try {
      return JSON.parse(raw);
    } catch {
      return {
        raw,
        error: 'Unable to parse evaluation response as JSON. Please check the prompt or API output.',
      };
    }
  }, 'evaluation');
}

module.exports = {
  chatResponse,
  evaluateTranscript,
};
