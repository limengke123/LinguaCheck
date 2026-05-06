import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  RotateCcw,
  Settings as SettingsIcon,
  X,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { runPrompt, testProvider } from "./api";
import { promptActions } from "./prompts";
import { createProvider, loadSettings, saveSettings } from "./storage";
import type { ActionType, AssistantResult, ProviderConfig, Settings } from "./types";

type ConnectionCheck = {
  status: "checking" | "ok" | "error";
  message: string;
};

function App() {
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [results, setResults] = useState<AssistantResult[]>([]);
  const [runningAction, setRunningAction] = useState<ActionType | null>(null);
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(() => new Set());
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null);
  const [isProviderPanelOpen, setIsProviderPanelOpen] = useState(false);
  const [connectionChecks, setConnectionChecks] = useState<Record<string, ConnectionCheck>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionGridRef = useRef<HTMLDivElement>(null);

  const activeProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === settings.activeProviderId) ??
      settings.providers.find((provider) => provider.id === settings.defaultProviderId) ??
      settings.providers[0],
    [settings],
  );

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Auto-paste with cmd+V or ctrl+V
      if ((event.metaKey || event.ctrlKey) && event.key === "v" && !event.shiftKey && !event.altKey) {
        const target = event.target as HTMLElement;
        if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
          event.preventDefault();
          navigator.clipboard.readText().then((text) => {
            if (text) {
              setInput(text);
              textareaRef.current?.focus();
            }
          }).catch(() => {
            // Fallback: just focus
            textareaRef.current?.focus();
          });
          return;
        }
      }

      // Action shortcuts: Cmd/Ctrl+1-5 for actions
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        const actionIndex = Number(event.key) - 1;
        if (actionIndex >= 0 && actionIndex < promptActions.length) {
          const action = promptActions[actionIndex];
          if (runningAction === null) {
            event.preventDefault();
            void handleAction(action.type);
          }
          return;
        }

        // Cmd/Ctrl+0 clears input
        if (event.key === "0") {
          event.preventDefault();
          setInput("");
          textareaRef.current?.focus();
          return;
        }
      }

      // Provider switching: cmd+1 through cmd+9
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < settings.providers.length) {
          event.preventDefault();
          setActiveProvider(settings.providers[index].id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.providers, runningAction]);

  async function handleAction(actionType: ActionType) {
    const trimmedInput = input.trim();
    if (!trimmedInput || !activeProvider) {
      return;
    }
    await runAction(actionType, trimmedInput, activeProvider);
  }

  async function handleRerun(result: AssistantResult) {
    const originalProvider =
      settings.providers.find((provider) => provider.id === result.providerId) ?? activeProvider;
    if (!result.input.trim() || !originalProvider) {
      return;
    }
    await runAction(result.action, result.input, originalProvider);
  }

  async function runAction(
    actionType: ActionType,
    sourceInput: string,
    provider: ProviderConfig | undefined,
  ) {
    const action = promptActions.find((item) => item.type === actionType);
    if (!action || !provider) {
      return;
    }

    const startedAt = performance.now();
    setRunningAction(action.type);
    setCopiedResultId(null);

    const resultId = crypto.randomUUID();
    setResults((current) => [
      {
        id: resultId,
        action: action.type,
        actionLabel: action.label,
        providerId: provider.id,
        providerName: provider.name,
        input: sourceInput,
        output: "",
        createdAt: new Date().toISOString(),
        durationMs: 0,
        status: "loading",
      },
      ...current,
    ]);
    setExpandedResultIds(new Set([resultId]));

    try {
      const output = await runPrompt(
        provider,
        action.buildPrompt(sourceInput),
        (chunk) => {
          setResults((current) =>
            current.map((r) =>
              r.id === resultId ? { ...r, output: r.output + chunk } : r,
            ),
          );
        },
      );
      setResults((current) =>
        current.map((r) =>
          r.id === resultId
            ? {
                ...r,
                output,
                durationMs: Math.round(performance.now() - startedAt),
                status: "done" as const,
              }
            : r,
        ),
      );
    } catch (error) {
      setResults((current) =>
        current.map((r) =>
          r.id === resultId
            ? {
                ...r,
                durationMs: Math.round(performance.now() - startedAt),
                error: error instanceof Error ? error.message : "请求失败。",
                status: "error" as const,
              }
            : r,
        ),
      );
    } finally {
      setRunningAction(null);
    }
  }

  function addResult(result: Omit<AssistantResult, "id" | "createdAt">) {
    const id = crypto.randomUUID();
    setResults((current) => [
      {
        ...result,
        id,
        createdAt: new Date().toISOString(),
        status: "done",
      },
      ...current,
    ]);
    setExpandedResultIds(new Set([id]));
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

  function toggleResult(resultId: string) {
    setExpandedResultIds((current) => {
      const next = new Set(current);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  }

  function deleteResult(resultId: string) {
    setResults((current) => current.filter((r) => r.id !== resultId));
  }

  async function copyResultOutput(result: AssistantResult) {
    try {
      await navigator.clipboard.writeText(result.output || result.error || "");
      setCopiedResultId(result.id);
    } catch {
      setCopiedResultId(null);
    }
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <section className="input-panel" aria-label="Input and actions">
          <div className="composer-shell">
            <textarea
              ref={textareaRef}
              className="main-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="粘贴英文、中文或混合文本。可以是一句话、一段邮件、一段技术讨论或你想润色的表达。"
              spellCheck
            />
            <div className="composer-meta">
              <span>{input.length} chars</span>
              <span>
                {activeProvider?.name || "No provider"} · {activeProvider?.model || "Model not set"}
              </span>
              <div className="composer-meta-actions">
                {input.length > 0 ? (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => {
                      setInput("");
                      textareaRef.current?.focus();
                    }}
                    title={navigator.platform.includes("Mac") ? "清空输入 (⌘0)" : "清空输入 (Ctrl+0)"}
                    aria-label="清空输入"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                ) : null}
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setIsProviderPanelOpen(true)}
                  title="Provider settings"
                  aria-label="Provider settings"
                >
                  <SettingsIcon size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={actionGridRef}
            className="action-grid"
            aria-label="Prompt actions"
          >
            {promptActions.map((action, index) => (
              <button
                className="button action-button"
                key={action.type}
                type="button"
                onClick={() => void handleAction(action.type)}
                disabled={runningAction !== null}
                title={`${action.description} (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}${index + 1})`}
              >
                <span className="action-label">
                  {runningAction === action.type ? "Running" : action.shortLabel}
                  <kbd className="action-kbd">{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}{index + 1}</kbd>
                </span>
                <small>{action.description}</small>
              </button>
            ))}
          </div>

        </section>

        <section className="output-panel" aria-label="Output cards">
          <div className="result-list">
            {results.length === 0 ? (
              <div className="empty-state">
                <h2>等待输出</h2>
                <p>输入文本并选择一个动作，结果会以 Markdown 卡片保留在这里。</p>
              </div>
            ) : (
              results.map((result) => (
                <ResultCard
                  copied={copiedResultId === result.id}
                  expanded={expandedResultIds.has(result.id)}
                  key={result.id}
                  result={result}
                  running={runningAction !== null}
                  onCopy={() => void copyResultOutput(result)}
                  onRerun={() => void handleRerun(result)}
                  onToggle={() => toggleResult(result.id)}
                  onDelete={() => deleteResult(result.id)}
                />
              ))
            )}
          </div>

          <div className="output-footer">
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

function ResultCard({
  copied,
  expanded,
  result,
  running,
  onCopy,
  onRerun,
  onToggle,
  onDelete,
}: {
  copied: boolean;
  expanded: boolean;
  result: AssistantResult;
  running: boolean;
  onCopy: () => void;
  onRerun: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const created = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(result.createdAt));

  const isLoading = result.status === "loading";

  return (
    <article
      className={
        result.status === "error"
          ? "result-card result-card--error"
          : isLoading
            ? "result-card result-card--loading"
            : expanded
              ? "result-card"
              : "result-card result-card--collapsed"
      }
    >
      <header className="result-card-header">
        <button
          className="collapse-button"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse result" : "Expand result"}
        >
          {expanded ? (
            <ChevronDown size={17} strokeWidth={2.25} />
          ) : (
            <ChevronRight size={17} strokeWidth={2.25} />
          )}
        </button>
        <button className="result-title-button" type="button" onClick={onToggle}>
          <span>{isLoading ? "加载中..." : result.actionLabel}</span>
          <small>
            {result.providerName} · {created}{isLoading ? "" : ` · ${result.durationMs}ms`}
          </small>
        </button>
        {!isLoading && (
          <div className="result-actions">
            <button
              className="icon-button result-icon-button"
              type="button"
              onClick={onRerun}
              disabled={running}
              title="Re-run"
              aria-label="Re-run"
            >
              <RotateCcw size={15} strokeWidth={2.2} />
            </button>
            <button
              className="icon-button result-icon-button"
              type="button"
              onClick={onDelete}
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={15} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </header>

      {expanded ? (
        <>
          {result.input ? (
            <blockquote className="input-quote">
              <span>Input</span>
              {result.input}
            </blockquote>
          ) : null}

          {result.status === "loading" ? (
            <div className="result-loading">
              <span className="loading-dots">正在输入</span>
            </div>
          ) : result.error ? (
            <div className="result-error">{result.error}</div>
          ) : (
            <div className="markdown-block">
              <button
                className="icon-button copy-block-button"
                type="button"
                onClick={onCopy}
                title="Copy output"
                aria-label="Copy output"
              >
                <Copy size={15} strokeWidth={2.2} />
              </button>
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.output}</ReactMarkdown>
              </div>
              {copied ? <span className="copy-state">Copied</span> : null}
            </div>
          )}
        </>
      ) : null}
    </article>
  );
}

export default App;
