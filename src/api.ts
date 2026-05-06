import type { Provider, Settings } from "./types";

export function validateProviderConfig(provider: Provider, settings: Settings): void {
  if (provider === "openai") {
    if (!settings.openaiApiKey.trim() && !isLocalBaseUrl(settings.openaiBaseUrl)) {
      throw new Error("OpenAI API key is required.");
    }
    if (!settings.openaiBaseUrl.trim()) {
      throw new Error("OpenAI base URL is required.");
    }
    if (!settings.openaiModel.trim()) {
      throw new Error("OpenAI model is required.");
    }
    return;
  }

  if (!settings.ollamaBaseUrl.trim()) {
    throw new Error("Ollama base URL is required.");
  }
  if (!settings.ollamaModel.trim()) {
    throw new Error("Ollama model is required.");
  }
}

export async function runPrompt(
  provider: Provider,
  settings: Settings,
  prompt: string,
): Promise<string> {
  validateProviderConfig(provider, settings);

  if (provider === "openai") {
    return runOpenAiCompatible(settings, prompt);
  }

  return runOllama(settings, prompt);
}

async function runOpenAiCompatible(settings: Settings, prompt: string): Promise<string> {
  const baseUrl = trimTrailingSlash(settings.openaiBaseUrl);
  const firstEndpoint = `${baseUrl}/chat/completions`;
  const response = await postChatCompletion(firstEndpoint, settings, prompt);
  const payload = await readJson<OpenAiResponse>(response);

  if (
    response.status === 404 &&
    !baseUrl.endsWith("/v1") &&
    !baseUrl.endsWith("/v1/")
  ) {
    const fallbackEndpoint = `${baseUrl}/v1/chat/completions`;
    const fallbackResponse = await postChatCompletion(fallbackEndpoint, settings, prompt);
    const fallbackPayload = await readJson<OpenAiResponse>(fallbackResponse);

    if (!fallbackResponse.ok) {
      throw new Error(
        extractError(
          fallbackPayload,
          `OpenAI-compatible request failed (${fallbackResponse.status}) at ${fallbackEndpoint}.`,
        ),
      );
    }

    return extractOpenAiContent(fallbackPayload);
  }

  if (!response.ok) {
    throw new Error(
      extractError(payload, `OpenAI-compatible request failed (${response.status}) at ${firstEndpoint}.`),
    );
  }

  return extractOpenAiContent(payload);
}

async function postChatCompletion(
  endpoint: string,
  settings: Settings,
  prompt: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = settings.openaiApiKey.trim();

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: settings.openaiModel.trim(),
      messages: [
        {
          role: "system",
          content:
            "You are a concise AI English assistant. Return structured Markdown and prioritize copyable results.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });
}

function extractOpenAiContent(payload: OpenAiResponse | null): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI-compatible response did not include message content.");
  }

  return content.trim();
}

async function runOllama(settings: Settings, prompt: string): Promise<string> {
  const baseUrl = trimTrailingSlash(settings.ollamaBaseUrl);
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.ollamaModel.trim(),
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
      },
    }),
  });

  const payload = await readJson<OllamaResponse>(response);

  if (!response.ok) {
    throw new Error(extractError(payload, `Ollama request failed (${response.status}).`));
  }

  const content = payload?.response;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama response did not include generated text.");
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

type OllamaResponse = {
  response?: string;
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
