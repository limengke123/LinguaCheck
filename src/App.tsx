import { useEffect, useMemo, useState } from "react";
import { runPrompt } from "./api";
import { buildObsidianMarkdown } from "./markdown";
import { promptActions } from "./prompts";
import {
  loadActiveProvider,
  loadSettings,
  saveActiveProvider,
  saveSettings,
} from "./storage";
import type { ActionType, AssistantResult, Provider, Settings } from "./types";

const providerLabels: Record<Provider, string> = {
  openai: "OpenAI-compatible",
  ollama: "Ollama",
};

function App() {
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [provider, setProvider] = useState<Provider>(() => loadActiveProvider());
  const [results, setResults] = useState<AssistantResult[]>([]);
  const [runningAction, setRunningAction] = useState<ActionType | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const latestSuccessfulResult = useMemo(
    () => results.find((result) => !result.error),
    [results],
  );

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveActiveProvider(provider);
  }, [provider]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        setProvider("openai");
      }

      if (event.key === "2") {
        event.preventDefault();
        setProvider("ollama");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleAction(actionType: ActionType) {
    const action = promptActions.find((item) => item.type === actionType);
    const trimmedInput = input.trim();
    if (!action) {
      return;
    }

    if (!trimmedInput) {
      addResult({
        action: action.type,
        actionLabel: action.label,
        provider,
        input: "",
        output: "",
        durationMs: 0,
        error: "Enter text before running an action.",
      });
      return;
    }

    const startedAt = performance.now();
    setRunningAction(action.type);
    setCopyState("idle");

    try {
      const output = await runPrompt(provider, settings, action.buildPrompt(trimmedInput));
      addResult({
        action: action.type,
        actionLabel: action.label,
        provider,
        input: trimmedInput,
        output,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      addResult({
        action: action.type,
        actionLabel: action.label,
        provider,
        input: trimmedInput,
        output: "",
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "Request failed.",
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

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
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
      <nav className="global-nav" aria-label="Global">
        <div className="global-nav__inner">
          <span className="brand-mark" aria-hidden="true">
            LC
          </span>
          <span>LinguaCheck</span>
          <span className="nav-spacer" />
          <span className="nav-hint">Pure frontend</span>
        </div>
      </nav>

      <header className="sub-nav">
        <div>
          <p className="eyebrow">AI English Assistant</p>
          <h1>Read, check, translate, polish.</h1>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={copyLatestMarkdown}
          disabled={!latestSuccessfulResult}
        >
          {copyState === "copied" ? "Copied" : "Copy Markdown"}
        </button>
      </header>

      <main className="workspace">
        <section className="work-panel" aria-label="Input and actions">
          <div className="input-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Input</p>
                <h2>Sentence or paragraph</h2>
              </div>
              <span className="provider-badge">{providerLabels[provider]}</span>
            </div>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste English, Chinese, or mixed text here."
              spellCheck
            />

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
                  <span>{action.shortLabel}</span>
                  <small>{action.description}</small>
                </button>
              ))}
            </div>
          </div>

          <section className="settings-card" aria-label="Model settings">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Model</p>
                <h2>Provider settings</h2>
              </div>
              {runningAction ? (
                <span className="status-pill">Running</span>
              ) : (
                <span className="status-pill status-pill--quiet">Ready</span>
              )}
            </div>

            <div className="provider-switch" role="radiogroup" aria-label="Model provider">
              <button
                className={provider === "openai" ? "selected" : ""}
                type="button"
                role="radio"
                aria-checked={provider === "openai"}
                onClick={() => setProvider("openai")}
              >
                OpenAI-compatible
                <kbd>⌘1</kbd>
              </button>
              <button
                className={provider === "ollama" ? "selected" : ""}
                type="button"
                role="radio"
                aria-checked={provider === "ollama"}
                onClick={() => setProvider("ollama")}
              >
                Ollama
                <kbd>⌘2</kbd>
              </button>
            </div>

            <div className="settings-grid">
              <label>
                <span>OpenAI-compatible API Key</span>
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(event) => updateSetting("openaiApiKey", event.target.value)}
                  placeholder="Optional for local servers"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>OpenAI-compatible Base URL</span>
                <input
                  type="url"
                  value={settings.openaiBaseUrl}
                  onChange={(event) => updateSetting("openaiBaseUrl", event.target.value)}
                  placeholder="https://api.openai.com/v1 or http://localhost:8099/v1"
                />
              </label>
              <label>
                <span>OpenAI-compatible Model</span>
                <input
                  value={settings.openaiModel}
                  onChange={(event) => updateSetting("openaiModel", event.target.value)}
                  placeholder="Required"
                />
              </label>
              <label>
                <span>Ollama Base URL</span>
                <input
                  type="url"
                  value={settings.ollamaBaseUrl}
                  onChange={(event) => updateSetting("ollamaBaseUrl", event.target.value)}
                  placeholder="http://localhost:11434"
                />
              </label>
              <label>
                <span>Ollama Model</span>
                <input
                  value={settings.ollamaModel}
                  onChange={(event) => updateSetting("ollamaModel", event.target.value)}
                  placeholder="Required"
                />
              </label>
            </div>

            {copyState === "failed" ? (
              <p className="form-note form-note--error">Clipboard access failed.</p>
            ) : (
              <p className="form-note">Configuration is stored in localStorage.</p>
            )}
          </section>
        </section>

        <section className="output-panel" aria-label="Output cards">
          <div className="output-header">
            <div>
              <p className="eyebrow">Output</p>
              <h2>Result cards</h2>
            </div>
            <span>{results.length} total</span>
          </div>

          <div className="result-list">
            {results.length === 0 ? (
              <div className="empty-state">
                <h3>No results yet.</h3>
                <p>Run an action to keep each response as a separate card.</p>
              </div>
            ) : (
              results.map((result) => <ResultCard key={result.id} result={result} />)
            )}
          </div>
        </section>
      </main>
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
      <header>
        <div>
          <p className="eyebrow">{result.actionLabel}</p>
          <h3>{result.error ? "Request issue" : "Check Result"}</h3>
        </div>
        <div className="result-meta">
          <span>{providerLabels[result.provider]}</span>
          <span>{created}</span>
          <span>{result.durationMs}ms</span>
        </div>
      </header>

      {result.input ? (
        <blockquote>
          <span>Input</span>
          {result.input}
        </blockquote>
      ) : null}

      {result.error ? (
        <pre className="result-error">{result.error}</pre>
      ) : (
        <pre>{result.output}</pre>
      )}
    </article>
  );
}

export default App;
