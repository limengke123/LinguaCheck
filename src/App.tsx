import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState } from "react";
import { runPrompt, testProvider } from "./api";
import { buildObsidianMarkdown } from "./markdown";
import { promptActions } from "./prompts";
import { createProvider, loadSettings, saveSettings } from "./storage";
import type { ActionType, AssistantResult, ProviderConfig, Settings } from "./types";

type CopyState = "idle" | "copied" | "failed";

type ConnectionCheck = {
  status: "checking" | "ok" | "error";
  message: string;
};

function App() {
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [results, setResults] = useState<AssistantResult[]>([]);
  const [runningAction, setRunningAction] = useState<ActionType | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [isProviderPanelOpen, setIsProviderPanelOpen] = useState(false);
  const [connectionChecks, setConnectionChecks] = useState<Record<string, ConnectionCheck>>({});

  const activeProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === settings.activeProviderId) ??
      settings.providers.find((provider) => provider.id === settings.defaultProviderId) ??
      settings.providers[0],
    [settings],
  );

  const latestSuccessfulResult = useMemo(
    () => results.find((result) => !result.error),
    [results],
  );

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      const index = Number(event.key) - 1;
      if (index >= 0 && index < settings.providers.length) {
        event.preventDefault();
        setActiveProvider(settings.providers[index].id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.providers]);

  async function handleAction(actionType: ActionType) {
    const action = promptActions.find((item) => item.type === actionType);
    const trimmedInput = input.trim();
    if (!action) {
      return;
    }

    if (!activeProvider) {
      addResult({
        action: action.type,
        actionLabel: action.label,
        providerId: "",
        providerName: "No provider",
        input: trimmedInput,
        output: "",
        durationMs: 0,
        error: "请先新增并配置一个 provider。",
      });
      return;
    }

    if (!trimmedInput) {
      addResult({
        action: action.type,
        actionLabel: action.label,
        providerId: activeProvider.id,
        providerName: activeProvider.name,
        input: "",
        output: "",
        durationMs: 0,
        error: "请输入文本后再运行操作。",
      });
      return;
    }

    const startedAt = performance.now();
    setRunningAction(action.type);
    setCopyState("idle");

    try {
      const output = await runPrompt(activeProvider, action.buildPrompt(trimmedInput));
      addResult({
        action: action.type,
        actionLabel: action.label,
        providerId: activeProvider.id,
        providerName: activeProvider.name,
        input: trimmedInput,
        output,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      addResult({
        action: action.type,
        actionLabel: action.label,
        providerId: activeProvider.id,
        providerName: activeProvider.name,
        input: trimmedInput,
        output: "",
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "请求失败。",
      });
    } finally {
      setRunningAction(null);
    }
  }

  function addResult(result: Omit<AssistantResult, "id" | "createdAt">) {
    setResults((current) => [
      {
        ...result,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  }

  function setActiveProvider(providerId: string) {
    setSettings((current) => ({
      ...current,
      activeProviderId: providerId,
    }));
  }

  function setDefaultProvider(providerId: string) {
    setSettings((current) => ({
      ...current,
      defaultProviderId: providerId,
    }));
  }

  function addProvider() {
    setSettings((current) => {
      const provider = createProvider(current.providers.length + 1);
      return {
        ...current,
        providers: [...current.providers, provider],
        activeProviderId: provider.id,
      };
    });
  }

  function updateProvider(providerId: string, patch: Partial<ProviderConfig>) {
    setSettings((current) => ({
      ...current,
      providers: current.providers.map((provider) =>
        provider.id === providerId ? { ...provider, ...patch } : provider,
      ),
    }));
    clearConnectionCheck(providerId);
  }

  function removeProvider(providerId: string) {
    setSettings((current) => {
      if (current.providers.length <= 1) {
        return current;
      }

      const providers = current.providers.filter((provider) => provider.id !== providerId);
      const defaultProviderId =
        current.defaultProviderId === providerId ? providers[0].id : current.defaultProviderId;
      const activeProviderId =
        current.activeProviderId === providerId ? defaultProviderId : current.activeProviderId;

      return {
        providers,
        defaultProviderId,
        activeProviderId,
      };
    });
    clearConnectionCheck(providerId);
  }

  async function handleTestProvider(provider: ProviderConfig) {
    setConnectionChecks((current) => ({
      ...current,
      [provider.id]: {
        status: "checking",
        message: "Checking...",
      },
    }));

    try {
      const message = await testProvider(provider);
      setConnectionChecks((current) => ({
        ...current,
        [provider.id]: {
          status: "ok",
          message,
        },
      }));
    } catch (error) {
      setConnectionChecks((current) => ({
        ...current,
        [provider.id]: {
          status: "error",
          message: error instanceof Error ? error.message : "Connection failed.",
        },
      }));
    }
  }

  function clearConnectionCheck(providerId: string) {
    setConnectionChecks((current) => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  async function copyLatestMarkdown() {
    if (!latestSuccessfulResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildObsidianMarkdown(latestSuccessfulResult));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <section className="input-panel" aria-label="Input and actions">
          <div className="utility-bar">
            <select
              className="provider-select"
              value={activeProvider?.id ?? ""}
              onChange={(event) => setActiveProvider(event.target.value)}
              aria-label="Active provider"
            >
              {settings.providers.map((provider, index) => (
                <option key={provider.id} value={provider.id}>
                  {index + 1}. {provider.name}
                  {provider.id === settings.defaultProviderId ? " · default" : ""}
                </option>
              ))}
            </select>

            <button
              className="button button-ghost"
              type="button"
              onClick={() => setIsProviderPanelOpen(true)}
            >
              Providers
            </button>

            <button
              className="button button-primary"
              type="button"
              onClick={copyLatestMarkdown}
              disabled={!latestSuccessfulResult}
            >
              {copyState === "copied" ? "Copied" : "Copy Markdown"}
            </button>
          </div>

          <div className="composer-shell">
            <textarea
              className="main-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="粘贴英文、中文或混合文本。可以是一句话、一段邮件、一段技术讨论或你想润色的表达。"
              spellCheck
            />
            <div className="composer-meta">
              <span>{input.length} chars</span>
              <span>{activeProvider?.model || "Model not set"}</span>
            </div>
          </div>

          <div className="action-grid" aria-label="Prompt actions">
            {promptActions.map((action) => (
              <button
                className="button action-button"
                key={action.type}
                type="button"
                onClick={() => void handleAction(action.type)}
                disabled={runningAction !== null}
                title={action.description}
              >
                <span>{runningAction === action.type ? "Running" : action.shortLabel}</span>
                <small>{action.description}</small>
              </button>
            ))}
          </div>

          {copyState === "failed" ? (
            <p className="inline-error">Clipboard access failed.</p>
          ) : null}
        </section>

        <section className="output-panel" aria-label="Output cards">
          <div className="output-toolbar">
            <span>{results.length} results</span>
            <button
              className="button button-ghost button-compact"
              type="button"
              disabled={results.length === 0}
              onClick={() => setResults([])}
            >
              Clear
            </button>
          </div>

          <div className="result-list">
            {results.length === 0 ? (
              <div className="empty-state">
                <h2>等待输出</h2>
                <p>输入文本并选择一个动作，结果会以 Markdown 卡片保留在这里。</p>
              </div>
            ) : (
              results.map((result) => <ResultCard key={result.id} result={result} />)
            )}
          </div>
        </section>
      </main>

      {isProviderPanelOpen ? (
        <ProviderPanel
          connectionChecks={connectionChecks}
          settings={settings}
          onAddProvider={addProvider}
          onClose={() => setIsProviderPanelOpen(false)}
          onRemoveProvider={removeProvider}
          onSetActiveProvider={setActiveProvider}
          onSetDefaultProvider={setDefaultProvider}
          onTestProvider={(provider) => void handleTestProvider(provider)}
          onUpdateProvider={updateProvider}
        />
      ) : null}
    </div>
  );
}

function ProviderPanel({
  connectionChecks,
  settings,
  onAddProvider,
  onClose,
  onRemoveProvider,
  onSetActiveProvider,
  onSetDefaultProvider,
  onTestProvider,
  onUpdateProvider,
}: {
  connectionChecks: Record<string, ConnectionCheck>;
  settings: Settings;
  onAddProvider: () => void;
  onClose: () => void;
  onRemoveProvider: (providerId: string) => void;
  onSetActiveProvider: (providerId: string) => void;
  onSetDefaultProvider: (providerId: string) => void;
  onTestProvider: (provider: ProviderConfig) => void;
  onUpdateProvider: (providerId: string, patch: Partial<ProviderConfig>) => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="provider-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-panel-title"
      >
        <header className="provider-panel-header">
          <div>
            <h2 id="provider-panel-title">Providers</h2>
            <p>OpenAI-compatible APIs only. Local providers can leave API key empty.</p>
          </div>
          <button className="button button-primary" type="button" onClick={onClose}>
            Done
          </button>
        </header>

        <div className="provider-default-row">
          <label>
            <span>Default provider</span>
            <select
              value={settings.defaultProviderId}
              onChange={(event) => onSetDefaultProvider(event.target.value)}
            >
              {settings.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>

          <button className="button button-ghost" type="button" onClick={onAddProvider}>
            Add Provider
          </button>
        </div>

        <div className="provider-list">
          {settings.providers.map((provider) => {
            const check = connectionChecks[provider.id];
            return (
              <article className="provider-card" key={provider.id}>
                <div className="provider-card-header">
                  <input
                    aria-label="Provider name"
                    className="provider-name-input"
                    value={provider.name}
                    onChange={(event) => onUpdateProvider(provider.id, { name: event.target.value })}
                  />
                  <div className="provider-card-actions">
                    {provider.id === settings.defaultProviderId ? (
                      <span className="provider-pill">Default</span>
                    ) : null}
                    {provider.id === settings.activeProviderId ? (
                      <span className="provider-pill provider-pill--active">Active</span>
                    ) : (
                      <button
                        className="button button-ghost button-compact"
                        type="button"
                        onClick={() => onSetActiveProvider(provider.id)}
                      >
                        Use
                      </button>
                    )}
                  </div>
                </div>

                <div className="provider-fields">
                  <label>
                    <span>Base URL</span>
                    <input
                      type="url"
                      value={provider.baseUrl}
                      onChange={(event) =>
                        onUpdateProvider(provider.id, { baseUrl: event.target.value })
                      }
                      placeholder="https://api.openai.com/v1 or http://localhost:8099/v1"
                    />
                  </label>
                  <label>
                    <span>Model</span>
                    <input
                      value={provider.model}
                      onChange={(event) =>
                        onUpdateProvider(provider.id, { model: event.target.value })
                      }
                      placeholder="Qwen3.6-35B-A3B-4bit"
                    />
                  </label>
                  <label>
                    <span>API Key</span>
                    <input
                      type="password"
                      value={provider.apiKey}
                      onChange={(event) =>
                        onUpdateProvider(provider.id, { apiKey: event.target.value })
                      }
                      placeholder="Optional for localhost"
                      autoComplete="off"
                    />
                  </label>
                </div>

                <div className="provider-test-row">
                  <button
                    className="button button-primary button-compact"
                    type="button"
                    disabled={check?.status === "checking"}
                    onClick={() => onTestProvider(provider)}
                  >
                    {check?.status === "checking" ? "Checking" : "Test"}
                  </button>
                  <button
                    className="button button-danger button-compact"
                    type="button"
                    disabled={settings.providers.length <= 1}
                    onClick={() => onRemoveProvider(provider.id)}
                  >
                    Delete
                  </button>
                  {check ? (
                    <span className={`check-message check-message--${check.status}`}>
                      {check.message}
                    </span>
                  ) : (
                    <span className="check-message">Not tested</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ResultCard({ result }: { result: AssistantResult }) {
  const created = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(result.createdAt));

  return (
    <article className={result.error ? "result-card result-card--error" : "result-card"}>
      <header className="result-card-header">
        <div>
          <h3>{result.actionLabel}</h3>
          <p>
            {result.providerName} · {created} · {result.durationMs}ms
          </p>
        </div>
      </header>

      {result.input ? (
        <blockquote className="input-quote">
          <span>Input</span>
          {result.input}
        </blockquote>
      ) : null}

      {result.error ? (
        <div className="result-error">{result.error}</div>
      ) : (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.output}</ReactMarkdown>
        </div>
      )}
    </article>
  );
}

export default App;
