import type { Provider, Settings } from "./types";

export const SETTINGS_KEY = "linguacheck.settings";
export const ACTIVE_PROVIDER_KEY = "linguacheck.activeProvider";

export const defaultSettings: Settings = {
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "",
};

export function loadSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadActiveProvider(): Provider {
  const stored = localStorage.getItem(ACTIVE_PROVIDER_KEY);
  return stored === "ollama" ? "ollama" : "openai";
}

export function saveActiveProvider(provider: Provider): void {
  localStorage.setItem(ACTIVE_PROVIDER_KEY, provider);
}
