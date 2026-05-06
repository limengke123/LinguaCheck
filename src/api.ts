import type { ProviderConfig } from "./types";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatRequestResult = {
  endpoint: string;
  payload: OpenAiResponse | null;
  response: Response;
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

export async function runPrompt(provider: ProviderConfig, prompt: string): Promise<string> {
  validateProviderConfig(provider);

  const result = await requestChatCompletion(provider, [
    {
      role: "system",
      content:
        "你是一个简洁、准确的 AI 英语助手。始终用中文解释和组织回复；英文原句、改写句和示例可以保留英文。只输出结构化 Markdown，优先给可直接复制使用的结果。",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  if (!result.response.ok) {
    throw new Error(
      extractError(
        result.payload,
        `Provider request failed (${result.response.status}) at ${result.endpoint}.`,
      ),
    );
  }

  return extractOpenAiContent(result.payload);
}

export async function testProvider(provider: ProviderConfig): Promise<string> {
  validateProviderConfig(provider);

  const result = await requestChatCompletion(provider, [
    {
      role: "system",
      content: "你只需要用中文回复“连接正常”。",
    },
    {
      role: "user",
      content: "请确认连接是否正常。",
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
): Promise<ChatRequestResult> {
  const endpoints = buildChatEndpoints(provider.baseUrl);
  let lastResult: ChatRequestResult | null = null;

  for (const endpoint of endpoints) {
    const response = await postChatCompletion(endpoint, provider, messages);
    const payload = await readJson<OpenAiResponse>(response);
    const result = { endpoint, payload, response };

    if (response.ok || response.status !== 404) {
      return result;
    }

    lastResult = result;
  }

  return lastResult as ChatRequestResult;
}

async function postChatCompletion(
  endpoint: string,
  provider: ProviderConfig,
  messages: ChatMessage[],
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = provider.apiKey.trim();

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model.trim(),
      messages,
      temperature: 0.2,
    }),
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
