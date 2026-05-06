import type { AssistantResult, ProviderConfig, Settings } from "./types";

const DB_NAME = "linguacheck";
const DB_VERSION = 1;
const RESULTS_STORE = "results";

export const SETTINGS_KEY = "linguacheck.settings";

const DEFAULT_PROVIDER_ID = "default-openai-compatible";

const defaultProvider: ProviderConfig = {
  id: DEFAULT_PROVIDER_ID,
  name: "Default Provider",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "",
};

export const defaultSettings: Settings = {
  providers: [defaultProvider],
  activeProviderId: DEFAULT_PROVIDER_ID,
  defaultProviderId: DEFAULT_PROVIDER_ID,
};

export function loadSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return cloneSettings(defaultSettings);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSettings(parsed);
  } catch {
    return cloneSettings(defaultSettings);
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function createProvider(index: number): ProviderConfig {
  return {
    id: crypto.randomUUID(),
    name: `Provider ${index}`,
    apiKey: "",
    baseUrl: "",
    model: "",
  };
}

function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") {
    return cloneSettings(defaultSettings);
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.providers)) {
    const providers = record.providers
      .map((provider, index) => normalizeProvider(provider, index))
      .filter((provider): provider is ProviderConfig => provider !== null);

    return finalizeSettings({
      providers,
      activeProviderId: readString(record.activeProviderId),
      defaultProviderId: readString(record.defaultProviderId),
    });
  }

  return migrateLegacySettings(record);
}

function migrateLegacySettings(record: Record<string, unknown>): Settings {
  const providers: ProviderConfig[] = [];
  const openaiProvider = normalizeProvider(
    {
      id: DEFAULT_PROVIDER_ID,
      name: "OpenAI-compatible",
      apiKey: record.openaiApiKey,
      baseUrl: record.openaiBaseUrl,
      model: record.openaiModel,
    },
    0,
  );

  if (openaiProvider) {
    providers.push(openaiProvider);
  }

  const legacyOllamaBaseUrl = readString(record.ollamaBaseUrl);
  const legacyOllamaModel = readString(record.ollamaModel);
  const hasLegacyOllamaConfig =
    Boolean(legacyOllamaModel) ||
    (Boolean(legacyOllamaBaseUrl) && legacyOllamaBaseUrl !== "http://localhost:11434");

  if (hasLegacyOllamaConfig) {
    providers.push({
      id: crypto.randomUUID(),
      name: "Migrated local provider",
      apiKey: "",
      baseUrl: legacyOllamaBaseUrl,
      model: legacyOllamaModel,
    });
  }

  return finalizeSettings({
    providers,
    activeProviderId: providers[0]?.id ?? "",
    defaultProviderId: providers[0]?.id ?? "",
  });
}

function normalizeProvider(value: unknown, index: number): ProviderConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record.id) || (index === 0 ? DEFAULT_PROVIDER_ID : crypto.randomUUID());
  const name = readString(record.name) || `Provider ${index + 1}`;

  return {
    id,
    name,
    apiKey: readString(record.apiKey),
    baseUrl: readString(record.baseUrl) || (index === 0 ? defaultProvider.baseUrl : ""),
    model: readString(record.model),
  };
}

function finalizeSettings(value: Settings): Settings {
  const providers = value.providers.length > 0 ? value.providers : [defaultProvider];
  const hasDefault = providers.some((provider) => provider.id === value.defaultProviderId);
  const defaultProviderId = hasDefault ? value.defaultProviderId : providers[0].id;
  const hasActive = providers.some((provider) => provider.id === value.activeProviderId);
  const activeProviderId = hasActive ? value.activeProviderId : defaultProviderId;

  return {
    providers,
    defaultProviderId,
    activeProviderId,
  };
}

function cloneSettings(settings: Settings): Settings {
  return {
    ...settings,
    providers: settings.providers.map((provider) => ({ ...provider })),
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// IndexedDB for results persistence
let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(RESULTS_STORE)) {
        const store = db.createObjectStore(RESULTS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

export async function loadResults(): Promise<AssistantResult[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESULTS_STORE, "readonly");
    const store = tx.objectStore(RESULTS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const results = (req.result as AssistantResult[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveResult(result: AssistantResult): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESULTS_STORE, "readwrite");
    const store = tx.objectStore(RESULTS_STORE);
    const req = store.put(result);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteResult(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESULTS_STORE, "readwrite");
    const store = tx.objectStore(RESULTS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearResults(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESULTS_STORE, "readwrite");
    const store = tx.objectStore(RESULTS_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
