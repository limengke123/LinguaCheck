import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { runPrompt, testProvider } from "./api";
import { promptActions } from "./prompts";
import { createProvider, loadResults, loadSettings, saveResult, saveSettings, deleteResult as dbDeleteResult, clearResults as dbClearResults } from "./storage";
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
  const outputRef = useRef<HTMLDivElement>(null);
  const actionGridRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ text: string; source: "input" | "output"; x: number; y: number } | null>(null);
  const resultsLoadedRef = useRef(false);

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

  // Load results from IndexedDB on mount
  useEffect(() => {
    loadResults().then((loaded) => {
      if (loaded.length > 0) {
        setResults(loaded);
        // Expand the most recent result
        if (loaded[0]) {
          setExpandedResultIds(new Set([loaded[0].id]));
        }
      }
      resultsLoadedRef.current = true;
    }).catch(() => {
      resultsLoadedRef.current = true;
    });
  }, []);

  // Selection detection for input and output - show popover on mouseup
  useEffect(() => {
    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }

      const anchor = sel.anchorNode;
      if (!anchor) {
        setSelection(null);
        return;
      }

      // Check if selection is within textarea
      const textarea = textareaRef.current;
      if (textarea && textarea.contains(anchor)) {
        setSelection({ text, source: "input", x: 0, y: 0 });
        return;
      }

      // Check if selection is within output panel
      const outputEl = document.querySelector(".output-panel");
      if (outputEl && outputEl.contains(anchor)) {
        setSelection({ text, source: "output", x: 0, y: 0 });
        return;
      }

      setSelection(null);
    }

    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }

      const anchor = sel.anchorNode;
      if (!anchor) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Check if selection is within textarea
      const textarea = textareaRef.current;
      if (textarea && textarea.contains(anchor)) {
        setSelection({ text, source: "input", x: rect.left + rect.width / 2, y: rect.top });
        return;
      }

      // Check if selection is within output panel
      const outputEl = document.querySelector(".output-panel");
      if (outputEl && outputEl.contains(anchor)) {
        setSelection({ text, source: "output", x: rect.left + rect.width / 2, y: rect.top });
        return;
      }

      setSelection(null);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Clear selection when clicking outside input/output
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isInInput = textareaRef.current?.contains(target);
      const isInOutput = document.querySelector(".output-panel")?.contains(target);
      const isInSelectionBar = document.querySelector(".selection-bar")?.contains(target);
      if (!isInInput && !isInOutput && !isInSelectionBar) {
        setSelection(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Clear selection when window loses focus
  useEffect(() => {
    function handleBlur() {
      setSelection(null);
    }
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
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

  async function handleAction(actionType: ActionType, selectionText?: string) {
    const trimmedInput = (selectionText ?? input).trim();
    if (!trimmedInput || !activeProvider) {
      return;
    }
    await runAction(actionType, trimmedInput, activeProvider);
  }

  async function handleRerun(result: AssistantResult, newInput?: string) {
    // Capture these upfront to avoid stale closures in async callbacks
    const resultId = result.id;
    const resultAction = result.action;
    const originalProvider =
      settings.providers.find((provider) => provider.id === result.providerId) ?? activeProvider;
    const inputToUse = newInput ?? result.input;
    if (!inputToUse.trim() || !originalProvider) {
      return;
    }

    const action = promptActions.find((item) => item.type === resultAction);
    if (!action) {
      return;
    }

    const startedAt = performance.now();
    setRunningAction(resultAction);
    setCopiedResultId(null);

    // Update existing card to loading state
    const loadingResult: AssistantResult = {
      ...result,
      input: inputToUse,
      output: "",
      error: undefined,
      durationMs: 0,
      status: "loading",
    };
    setResults((current) =>
      current.map((r) => (r.id === resultId ? loadingResult : r)),
    );
    void saveResult(loadingResult);

    try {
      const output = await runPrompt(
        originalProvider,
        action.buildPrompt(inputToUse),
        (chunk) => {
          setResults((current) =>
            current.map((r) =>
              r.id === resultId ? { ...r, output: r.output + chunk } : r,
            ),
          );
        },
      );
      const finalResult: AssistantResult = {
        ...loadingResult,
        output,
        durationMs: Math.round(performance.now() - startedAt),
        status: "done",
      };
      setResults((current) =>
        current.map((r) => (r.id === resultId ? finalResult : r)),
      );
      void saveResult(finalResult);
    } catch (error) {
      const errorResult: AssistantResult = {
        ...loadingResult,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "请求失败。",
        status: "error",
      };
      setResults((current) =>
        current.map((r) => (r.id === resultId ? errorResult : r)),
      );
      void saveResult(errorResult);
    } finally {
      setRunningAction(null);
    }
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
    const newResult: AssistantResult = {
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
    };
    setResults((current) => [newResult, ...current]);
    setExpandedResultIds(new Set([resultId]));
    void saveResult(newResult);

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
      const finalResult: AssistantResult = {
        ...newResult,
        output,
        durationMs: Math.round(performance.now() - startedAt),
        status: "done",
      };
      setResults((current) =>
        current.map((r) => (r.id === resultId ? finalResult : r)),
      );
      void saveResult(finalResult);
    } catch (error) {
      const errorResult: AssistantResult = {
        ...newResult,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "请求失败。",
        status: "error",
      };
      setResults((current) =>
        current.map((r) => (r.id === resultId ? errorResult : r)),
      );
      void saveResult(errorResult);
    } finally {
      setRunningAction(null);
    }
  }

  function addResult(result: Omit<AssistantResult, "id" | "createdAt">) {
    const id = crypto.randomUUID();
    const newResult: AssistantResult = {
      ...result,
      id,
      createdAt: new Date().toISOString(),
      status: "done",
    };
    setResults((current) => [newResult, ...current]);
    setExpandedResultIds(new Set([id]));
    void saveResult(newResult);
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
    void dbDeleteResult(resultId);
  }

  function clearAllResults() {
    setResults([]);
    void dbClearResults();
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
      {selection && selection.x !== 0 ? (
        <div
          className="selection-bar"
          style={{
            position: "fixed",
            left: selection.x,
            top: selection.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="selection-actions">
            {promptActions.map((action) => (
              <button
                className="button button-ghost button-compact"
                key={action.type}
                type="button"
                onClick={() => void handleAction(action.type, selection.text)}
                disabled={runningAction !== null}
                title={action.description}
              >
                {action.shortLabel}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
                  onRerun={(newInput) => void handleRerun(result, newInput)}
                  onToggle={() => toggleResult(result.id)}
                  onDelete={() => deleteResult(result.id)}
                />
              ))
            )}
          </div>

          <div className="output-footer">
            <div className="footer-left">
              <span className="footer-provider">
                {activeProvider?.name || "No provider"}
              </span>
              <span className="footer-sep">·</span>
              <span className="footer-count">{results.length} result{results.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="footer-actions">
              <a
                className="icon-button footer-settings"
                href="https://github.com/limengke123/LinguaCheck"
                target="_blank"
                rel="noopener noreferrer"
                title="View on GitHub"
                aria-label="View on GitHub"
                style={{ display: 'grid' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <button
                className="icon-button footer-settings"
                type="button"
                onClick={() => setIsProviderPanelOpen(true)}
                title="Provider settings"
                aria-label="Provider settings"
              >
                <SettingsIcon size={15} strokeWidth={2} />
              </button>
              <button
                className="button button-ghost button-compact"
                type="button"
                disabled={results.length === 0}
                onClick={clearAllResults}
              >
                Clear
              </button>
            </div>
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
  onRerun: (newInput?: string) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [inputCollapsed, setInputCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedInput, setEditedInput] = useState(result.input);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const INPUT_PREVIEW_LENGTH = 200;

  const created = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(result.createdAt));

  const isLoading = result.status === "loading";
  const inputLong = result.input.length > INPUT_PREVIEW_LENGTH;

  useEffect(() => {
    if (isEditing) {
      editTextareaRef.current?.focus();
    }
  }, [isEditing]);

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
          <span className="result-input-preview">
            {isLoading ? "加载中..." : result.input || "(empty)"}
          </span>
          <small>
            {result.actionLabel} · {created}{isLoading ? "" : ` · ${result.durationMs}ms`}
          </small>
        </button>
        {!isLoading && (
          <div className="result-actions">
            {isEditing ? (
              <>
                <button
                  className="icon-button result-icon-button"
                  type="button"
                  onClick={() => {
                    setEditedInput(result.input);
                    setIsEditing(false);
                  }}
                  title="Cancel"
                  aria-label="Cancel edit"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
                <button
                  className="icon-button result-icon-button"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    onRerun(editedInput);
                  }}
                  disabled={running}
                  title="Re-run with new input"
                  aria-label="Re-run with new input"
                >
                  <RotateCcw size={15} strokeWidth={2.2} />
                </button>
              </>
            ) : (
              <button
                className="icon-button result-icon-button"
                type="button"
                onClick={() => onRerun()}
                disabled={running}
                title="Re-run"
                aria-label="Re-run"
              >
                <RotateCcw size={15} strokeWidth={2.2} />
              </button>
            )}
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
            isEditing ? (
              <div className="input-edit-area">
                <textarea
                  ref={editTextareaRef}
                  className="input-edit-textarea input-edit-textarea--active"
                  value={editedInput}
                  onChange={(e) => setEditedInput(e.target.value)}
                  rows={Math.max(3, editedInput.split("\n").length)}
                />
                <div className="input-edit-actions">
                  <button
                    className="button button-ghost button-compact"
                    type="button"
                    onClick={() => {
                      setEditedInput(result.input);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-primary button-compact"
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      onRerun(editedInput);
                    }}
                    disabled={running}
                  >
                    Re-run
                  </button>
                </div>
              </div>
            ) : (
              <blockquote className="input-quote">
                <button
                  className="input-quote-header"
                  type="button"
                  onClick={() => setInputCollapsed((c) => !c)}
                >
                  <span>Input</span>
                  {inputLong ? (
                    <span className="input-quote-toggle">
                      {inputCollapsed ? "Show more" : "Show less"}
                    </span>
                  ) : null}
                </button>
                <p className={`input-quote-text ${inputCollapsed && inputLong ? "input-quote-text--collapsed" : ""}`}>
                  {result.input}
                  <button
                    className="icon-button input-edit-inline-button"
                    type="button"
                    onClick={() => {
                      setEditedInput(result.input);
                      setIsEditing(true);
                    }}
                    title="Edit input"
                    aria-label="Edit input"
                  >
                    <Edit2 size={14} strokeWidth={2.2} />
                  </button>
                </p>
              </blockquote>
            )
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
