import type { ProviderConfig } from "./types";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatRequestResult = {
  endpoint: string;
  payload: OpenAiResponse | null;
  response: Response;
  content?: string;
};

export function validateProviderConfig(provider: ProviderConfig): void {
  if (!provider.name.trim()) {
    throw new Error("Provider name is required.");
  }
  if (!provider.baseUrl.trim()) {
    throw new Error("Provider base URL is required.");
  }
  if (!provider.model.trim()) {
    throw new Error("Provider model is required.");
  }
  if (!provider.apiKey.trim() && !isLocalBaseUrl(provider.baseUrl)) {
    throw new Error("API key is required for non-local providers.");
  }
}

export async function runPrompt(
  provider: ProviderConfig,
  prompt: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  validateProviderConfig(provider);

  const result = await requestChatCompletion(
    provider,
    [
      {
        role: "system",
        content:
          "You are a concise, accurate AI English assistant. Always explain and organize responses in Chinese; English original sentences, rewrites, and examples may remain in English. Output structured Markdown only, preferring results that can be copied and used directly.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    onChunk,
  );

  if (!result.response.ok) {
    throw new Error(
      extractError(
        result.payload,
        `Provider request failed (${result.response.status}) at ${result.endpoint}.`,
      ),
    );
  }

  if (onChunk) {
    return result.content ?? "";
  }

  return extractOpenAiContent(result.payload);
}

export async function testProvider(provider: ProviderConfig): Promise<string> {
  validateProviderConfig(provider);

  const result = await requestChatCompletion(provider, [
    {
      role: "system",
      content: "You only need to reply in Chinese: \u201c\u8fde\u63a5\u6b63\u5e38\u201d.",
    },
    {
      role: "user",
      content: "\u8bf7\u786e\u8ba4\u8fde\u63a5\u662f\u5426\u6b63\u5e38\u3002",
    },
  ]);

  if (!result.response.ok) {
    throw new Error(
      extractError(
        result.payload,
        `Provider connection failed (${result.response.status}) at ${result.endpoint}.`,
      ),
    );
  }

  return `Connected via ${result.endpoint}`;
}

async function requestChatCompletion(
  provider: ProviderConfig,
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void,
): Promise<ChatRequestResult> {
  const endpoints = buildChatEndpoints(provider.baseUrl);
  let lastResult: ChatRequestResult | null = null;

  for (const endpoint of endpoints) {
    const response = await postChatCompletion(endpoint, provider, messages, onChunk);

    if (onChunk && response.ok) {
      const content = await readStream(response, onChunk);
      return { endpoint, payload: null, response, content };
    }

    const payload = await readJson<OpenAiResponse>(response);
    const result = { endpoint, payload, response };

    if (response.ok || response.status !== 404) {
      return result;
    }

    lastResult = result;
  }

  return lastResult as ChatRequestResult;
}

async function readStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            return content;
          }
          try {
            const parsed = JSON.parse(data) as OpenAiResponse;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              content += delta;
              onChunk(delta);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return content;
}

async function postChatCompletion(
  endpoint: string,
  provider: ProviderConfig,
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = provider.apiKey.trim();

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: provider.model.trim(),
    messages,
    temperature: 0.2,
  };

  if (onChunk) {
    body.stream = true;
  }

  return fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function buildChatEndpoints(baseUrl: string): string[] {
  const base = trimTrailingSlash(baseUrl);

  if (base.endsWith("/chat/completions")) {
    return [base];
  }

  const primary = `${base}/chat/completions`;
  if (base.endsWith("/v1")) {
    return [primary];
  }

  return [primary, `${base}/v1/chat/completions`];
}

function extractOpenAiContent(payload: OpenAiResponse | null): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider response did not include message content.");
  }

  return content.trim();
}

type OpenAiResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  error?: string | { message?: string };
  message?: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const maybeError = "error" in payload ? payload.error : undefined;

    if (typeof maybeError === "string") {
      return maybeError;
    }

    if (maybeError && typeof maybeError === "object" && "message" in maybeError) {
      const message = maybeError.message;
      if (typeof message === "string") {
        return message;
      }
    }

    if ("message" in payload) {
      const message = payload.message;
      if (typeof message === "string") {
        return message;
      }
    }
  }

  return fallback;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLocalBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}