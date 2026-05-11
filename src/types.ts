import type { LucideIcon } from "lucide-react";
export type { LucideIcon };

export type ActionType =
  | "explain"
  | "enToZh"
  | "zhToEn"
  | "polish"
  | "check"
  | "search"
  | "correct_grammar"
  | "translate_en"
  | "translate_zh"
  | "explain_meaning"
  | "rewrite_polish";

export type PromptAction = {
  id: string; // UUID for custom, type string for default
  type: ActionType;
  label: string; // max 20 chars
  shortLabel: string;
  description: string;
  systemPrompt: string; // the prefix that wraps user input
  icon?: LucideIcon; // lucide-react icon component
  iconName?: string; // lucide-react icon name string (for serialization)
  enabled?: boolean; // defaults to true
};

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
  ttsVoiceName?: string;
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
  status: "loading" | "done" | "error";
  pinned?: boolean;
  iconName?: string;
  temporary?: boolean;
};
