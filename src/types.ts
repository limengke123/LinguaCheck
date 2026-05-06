export type ActionType = "explain" | "enToZh" | "zhToEn" | "polish" | "check";

export type ProviderConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type Settings = {
  providers: ProviderConfig[];
  activeProviderId: string;
  defaultProviderId: string;
};

export type AssistantResult = {
  id: string;
  action: ActionType;
  actionLabel: string;
  providerId: string;
  providerName: string;
  input: string;
  output: string;
  createdAt: string;
  durationMs: number;
  error?: string;
};
