export type Provider = "openai" | "ollama";

export type ActionType = "explain" | "enToZh" | "zhToEn" | "polish" | "check";

export type Settings = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
};

export type AssistantResult = {
  id: string;
  action: ActionType;
  actionLabel: string;
  provider: Provider;
  input: string;
  output: string;
  createdAt: string;
  durationMs: number;
  error?: string;
};
