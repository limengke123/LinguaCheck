import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownLeft,
  Edit2,
  Languages,
  Loader2,
  MessageSquare,
  PenTool,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  SpellCheck,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { runPrompt, testProvider } from "./api";
import { buildPrompt } from "./prompts";
import type { PromptAction } from "./prompts";
import { createProvider, createPromptAction, defaultPromptActions, loadPromptActions, loadResults, loadSettings, savePromptActions, saveResult, saveSettings, deleteResult as dbDeleteResult, clearResults as dbClearResults } from "./storage";
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
  type ConfigTab = 'provider' | 'prompts' | 'settings';
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('linguacheck.darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [promptActions, setPromptActions] = useState<PromptAction[]>(() => loadPromptActions());
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

  // Apply dark mode class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('linguacheck.darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

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
  }, [settings.providers, runningAction, promptActions]);

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
        buildPrompt(action, inputToUse),
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
        buildPrompt(action, sourceInput),
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

  function handleRestore(input: string) {
    setInput(input);
    textareaRef.current?.focus();
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

          <div className="action-grid-header">
            <span className="action-grid-title">Actions</span>
            <button
              className="icon-button"
              type="button"
              onClick={() => setActiveConfigTab('prompts')}
              title="Configure prompts"
              aria-label="Configure prompts"
            >
              <SettingsIcon size={15} strokeWidth={2} />
            </button>
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
                  onRestore={(input) => handleRestore(input)}
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
                onClick={() => setActiveConfigTab('provider')}
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

      {activeConfigTab !== null ? (
        <ConfigPanel
          activeTab={activeConfigTab}
          connectionChecks={connectionChecks}
          settings={settings}
          promptActions={promptActions}
          activeProvider={activeProvider}
          onTabChange={setActiveConfigTab}
          onAddProvider={addProvider}
          onRemoveProvider={removeProvider}
          onSetActiveProvider={setActiveProvider}
          onSetDefaultProvider={setDefaultProvider}
          onTestProvider={(provider) => void handleTestProvider(provider)}
          onUpdateProvider={updateProvider}
          onGeneratePrompt={async (description: string) => {
            const prompt = `Generate a useful AI assistant instruction prompt for: ${description}. Reply with ONLY the system prompt text, no explanation.`;
            const result = await runPrompt(activeProvider!, prompt);
            return result.trim();
          }}
          onSavePromptActions={(actions) => {
            setPromptActions(actions);
            savePromptActions(actions);
          }}
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

function ConfigPanel({
  activeTab,
  connectionChecks,
  settings,
  promptActions,
  activeProvider,
  onTabChange,
  onAddProvider,
  onRemoveProvider,
  onSetActiveProvider,
  onSetDefaultProvider,
  onTestProvider,
  onUpdateProvider,
  onGeneratePrompt,
  onSavePromptActions,
}: {
  activeTab: 'provider' | 'prompts' | 'settings';
  connectionChecks: Record<string, ConnectionCheck>;
  settings: Settings;
  promptActions: PromptAction[];
  activeProvider: ProviderConfig | undefined;
  onTabChange: (tab: 'provider' | 'prompts' | 'settings' | null) => void;
  onAddProvider: () => void;
  onRemoveProvider: (providerId: string) => void;
  onSetActiveProvider: (providerId: string) => void;
  onSetDefaultProvider: (providerId: string) => void;
  onTestProvider: (provider: ProviderConfig) => void;
  onUpdateProvider: (providerId: string, patch: Partial<ProviderConfig>) => void;
  onGeneratePrompt: (description: string) => Promise<string>;
  onSavePromptActions: (actions: PromptAction[]) => void;
}) {
  const [localActions, setLocalActions] = useState(promptActions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<{ mode: "view" } | { mode: "edit"; label: string; shortLabel: string; systemPrompt: string; iconName: string }>({ mode: "view" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateDescription, setGenerateDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('linguacheck.darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    setLocalActions(promptActions);
  }, [promptActions]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('linguacheck.darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const tabs: { id: 'provider' | 'prompts' | 'settings'; label: string }[] = [
    { id: 'provider', label: 'Provider' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'settings', label: 'Settings' },
  ];

  function startEdit(item: PromptAction) {
    setEditingId(item.id);
    setEditState({
      mode: "edit",
      label: item.label,
      shortLabel: item.shortLabel,
      systemPrompt: item.systemPrompt,
      iconName: item.iconName ?? "SpellCheck",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ mode: "view" });
  }

  function saveEdit(id: string) {
    if (editState.mode !== "edit") return;
    setLocalActions((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              label: editState.label.slice(0, 20),
              shortLabel: editState.shortLabel.slice(0, 20) || editState.label.slice(0, 10),
              systemPrompt: editState.systemPrompt,
              iconName: editState.iconName,
            }
          : item,
      ),
    );
    setEditingId(null);
    setEditState({ mode: "view" });
  }

  function deleteItem(id: string) {
    if (localActions.length <= 1) return;
    setLocalActions((current) => current.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
  }

  function addNew() {
    const newAction = createPromptAction();
    setLocalActions((current) => [...current, newAction]);
    startEdit(newAction);
  }

  async function addAIGenerated() {
    if (!generateDescription.trim()) return;
    setIsGenerating(true);
    try {
      const generatedPrompt = await onGeneratePrompt(generateDescription.trim());
      const newAction: PromptAction = {
        id: crypto.randomUUID(),
        type: "explain",
        label: "AI Generated",
        shortLabel: "AI",
        description: generateDescription.trim().slice(0, 50),
        systemPrompt: generatedPrompt,
        iconName: "Wand2",
      };
      setLocalActions((current) => [...current, newAction]);
      setShowGenerateDialog(false);
      setGenerateDescription("");
      startEdit(newAction);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleRestoreDefaults() {
    setLocalActions(defaultPromptActions);
    onSavePromptActions(defaultPromptActions);
    setShowRestoreConfirm(false);
  }

  function handleSaveAndClose() {
    onSavePromptActions(localActions);
    onTabChange(null);
  }

  const ICON_OPTIONS = [
    { name: "SpellCheck", icon: SpellCheck },
    { name: "Languages", icon: Languages },
    { name: "BookOpen", icon: BookOpen },
    { name: "PenTool", icon: PenTool },
    { name: "Wand2", icon: Wand2 },
    { name: "MessageSquare", icon: MessageSquare },
  ];

  function getIconByName(name: string) {
    return ICON_OPTIONS.find((o) => o.name === name)?.icon ?? SpellCheck;
  }

  const SYSTEM_PROMPT_TEMPLATES = [
    { label: "纠正语法", prompt: "You are an English teacher. Correct the grammar of the following text without changing its meaning. Output only the corrected text:\n\n" },
    { label: "翻译英文", prompt: "You are a translator. Translate the following Chinese text to English. Output only the translation:\n\n" },
    { label: "翻译中文", prompt: "You are a translator. Translate the following English text to Chinese. Output only the translation:\n\n" },
    { label: "解释意思", prompt: "You are an English teacher. Explain the meaning of the following text in Chinese, including key vocabulary and grammar points:\n\n" },
    { label: "改写润色", prompt: "You are a writing assistant. Rewrite the following text to make it more polished, natural, and well-structured while keeping the same meaning:\n\n" },
    { label: "空白", prompt: "You are a helpful assistant. " },
  ];

  const previewLength = 80;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onTabChange(null)}>
      <section
        className="provider-panel config-panel"
        role="dialog"
        aria-modal="true"
      >
        <header className="provider-panel-header">
          <div className="config-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`config-tab ${activeTab === tab.id ? 'config-tab--active' : ''}`}
                type="button"
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="button button-primary" type="button" onClick={() => onTabChange(null)}>
            Done
          </button>
        </header>

        <div className="config-content">
          {activeTab === 'provider' && (
            <div className="provider-tab-content">
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
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="prompts-tab-content">
              <div className="prompt-config-list">
                {localActions.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <article className="prompt-config-item" key={item.id}>
                      {isEditing && editState.mode === "edit" ? (
                        <div className="prompt-config-edit">
                          <div className="prompt-config-edit-row">
                            <label className="prompt-config-field">
                              <span>Button Label (max 20)</span>
                              <input
                                className="provider-name-input"
                                value={editState.label}
                                onChange={(e) =>
                                  setEditState((s) =>
                                    s.mode === "edit"
                                      ? { ...s, label: e.target.value }
                                      : s,
                                  )
                                }
                                maxLength={20}
                              />
                            </label>
                            <label className="prompt-config-field">
                              <span>Short Label (max 20)</span>
                              <input
                                className="provider-name-input"
                                value={editState.shortLabel}
                                onChange={(e) =>
                                  setEditState((s) =>
                                    s.mode === "edit"
                                      ? { ...s, shortLabel: e.target.value }
                                      : s,
                                  )
                                }
                                maxLength={20}
                              />
                            </label>
                          </div>

                          <div className="prompt-config-edit-row">
                            <label className="prompt-config-field prompt-config-field--icon">
                              <span>Icon</span>
                              <div className="prompt-icon-picker">
                                {ICON_OPTIONS.map((opt) => {
                                  const Icon = opt.icon;
                                  const selected = editState.iconName === opt.name;
                                  return (
                                    <button
                                      key={opt.name}
                                      type="button"
                                      className={`prompt-icon-option ${selected ? "prompt-icon-option--selected" : ""}`}
                                      onClick={() =>
                                        setEditState((s) =>
                                          s.mode === "edit"
                                            ? { ...s, iconName: opt.name }
                                            : s,
                                        )
                                      }
                                      title={opt.name}
                                    >
                                      <Icon size={16} strokeWidth={2} />
                                    </button>
                                  );
                                })}
                              </div>
                            </label>
                            <label className="prompt-config-field">
                              <span>Quick Template</span>
                              <select
                                className="provider-fields"
                                value=""
                                onChange={(e) => {
                                  const tmpl = SYSTEM_PROMPT_TEMPLATES[Number(e.target.value)];
                                  if (tmpl) {
                                    setEditState((s) =>
                                      s.mode === "edit"
                                        ? {
                                            ...s,
                                            systemPrompt: tmpl.prompt,
                                            label: tmpl.label.slice(0, 20),
                                            shortLabel: tmpl.label.slice(0, 10),
                                          }
                                        : s,
                                    );
                                  }
                                  e.target.value = "";
                                }}
                              >
                                <option value="">Choose template...</option>
                                {SYSTEM_PROMPT_TEMPLATES.map((tmpl, i) => (
                                  <option key={tmpl.label} value={i}>
                                    {tmpl.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <label className="prompt-config-field">
                            <span>System Prompt</span>
                            <textarea
                              className="prompt-config-textarea"
                              value={editState.systemPrompt}
                              onChange={(e) =>
                                setEditState((s) =>
                                  s.mode === "edit"
                                    ? { ...s, systemPrompt: e.target.value }
                                    : s,
                                )
                              }
                              rows={4}
                            />
                          </label>

                          <div className="prompt-config-edit-actions">
                            <button
                              className="button button-ghost button-compact"
                              type="button"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                            <button
                              className="button button-primary button-compact"
                              type="button"
                              onClick={() => saveEdit(item.id)}
                            >
                              <Check size={14} strokeWidth={2.5} />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : confirmDeleteId === item.id ? (
                        <div className="prompt-config-confirm-delete">
                          <span>Delete "{item.label}"? This cannot be undone.</span>
                          <div className="prompt-config-confirm-actions">
                            <button
                              className="button button-ghost button-compact"
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              className="button button-danger button-compact"
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              disabled={localActions.length <= 1}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="prompt-config-view">
                          <div className="prompt-config-view-icon">
                            {(() => {
                              const Icon = getIconByName(item.iconName ?? "SpellCheck");
                              return <Icon size={18} strokeWidth={2} />;
                            })()}
                          </div>
                          <div className="prompt-config-view-content">
                            <span className="prompt-config-label">{item.label}</span>
                            <span className="prompt-config-desc">{item.description}</span>
                            <small className="prompt-config-preview">
                              {item.systemPrompt.slice(0, previewLength)}
                              {item.systemPrompt.length > previewLength ? "…" : ""}
                            </small>
                          </div>
                          <div className="prompt-config-view-actions">
                            <button
                              className="icon-button result-icon-button"
                              type="button"
                              onClick={() => startEdit(item)}
                              title="Edit"
                              aria-label="Edit"
                            >
                              <Edit2 size={14} strokeWidth={2.2} />
                            </button>
                            <button
                              className="icon-button result-icon-button"
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              title="Delete"
                              aria-label="Delete"
                              disabled={localActions.length <= 1}
                            >
                              <Trash2 size={14} strokeWidth={2.2} />
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="prompt-config-footer">
                <button className="button button-ghost" type="button" onClick={addNew}>
                  <Plus size={16} strokeWidth={2.5} />
                  Add New
                </button>
                {showRestoreConfirm ? (
                  <div className="prompt-config-confirm-footer">
                    <span>Restore all prompts to defaults?</span>
                    <div className="prompt-config-confirm-actions">
                      <button
                        className="button button-ghost button-compact"
                        type="button"
                        onClick={() => setShowRestoreConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-danger button-compact"
                        type="button"
                        onClick={() => void handleRestoreDefaults()}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="button button-ghost button-compact"
                    type="button"
                    onClick={() => setShowRestoreConfirm(true)}
                  >
                    Restore Defaults
                  </button>
                )}
                <button
                  className="button button-ghost button-compact"
                  type="button"
                  onClick={() => setShowGenerateDialog(true)}
                  title="AI Generate new prompt"
                >
                  <Wand2 size={14} strokeWidth={2.5} />
                  AI Generate
                </button>
              </div>

              {showGenerateDialog && (
                <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isGenerating && setShowGenerateDialog(false)}>
                  <div className="generate-prompt-dialog">
                    <div className="generate-prompt-header">
                      <h3>AI Generate Prompt</h3>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => !isGenerating && setShowGenerateDialog(false)}
                        disabled={isGenerating}
                      >
                        <X size={16} strokeWidth={2} />
                      </button>
                    </div>
                    <p>Describe what you want this prompt to do, and AI will generate it for you.</p>
                    <input
                      className="provider-name-input"
                      type="text"
                      placeholder="e.g., help me check grammar politely"
                      value={generateDescription}
                      onChange={(e) => setGenerateDescription(e.target.value)}
                      disabled={isGenerating}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isGenerating && generateDescription.trim()) {
                          void addAIGenerated();
                        }
                        if (e.key === "Escape" && !isGenerating) {
                          setShowGenerateDialog(false);
                        }
                      }}
                      autoFocus
                    />
                    <div className="generate-prompt-actions">
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => !isGenerating && setShowGenerateDialog(false)}
                        disabled={isGenerating}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => void addAIGenerated()}
                        disabled={isGenerating || !generateDescription.trim()}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 size={14} strokeWidth={2.5} className="spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 size={14} strokeWidth={2.5} />
                            Generate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-tab-content">
              <div className="settings-section">
                <h3>Appearance</h3>
                <label className="settings-toggle">
                  <span>Dark Mode</span>
                  <button
                    type="button"
                    className={`toggle-switch ${isDarkMode ? 'toggle-switch--active' : ''}`}
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    role="switch"
                    aria-checked={isDarkMode}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'prompts' && (
          <div className="config-footer">
            <button
              className="button button-primary"
              type="button"
              onClick={handleSaveAndClose}
            >
              Done
            </button>
          </div>
        )}
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
  onRestore,
  onToggle,
  onDelete,
}: {
  copied: boolean;
  expanded: boolean;
  result: AssistantResult;
  running: boolean;
  onCopy: () => void;
  onRerun: (newInput?: string) => void;
  onRestore: (input: string) => void;
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (event.key === "Escape" && isEditing) {
        event.preventDefault();
        setEditedInput(result.input);
        setIsEditing(false);
        return;
      }

      if (modifier && event.key === "Enter" && isEditing) {
        event.preventDefault();
        setIsEditing(false);
        onRerun(editedInput);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, editedInput, result.input, onRerun]);

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
                <div
                  className="input-quote-header"
                  onClick={() => setInputCollapsed((c) => !c)}
                >
                  <span>Input</span>
                  {inputLong ? (
                    <span className="input-quote-toggle">
                      {inputCollapsed ? "Show more" : "Show less"}
                    </span>
                  ) : null}
                  <div className="input-quote-header-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditedInput(result.input);
                        setIsEditing(true);
                      }}
                      title="Edit input"
                      aria-label="Edit input"
                    >
                      <Edit2 size={14} strokeWidth={2.2} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(result.input);
                      }}
                      title="Restore to main input"
                      aria-label="Restore to main input"
                    >
                      <CornerDownLeft size={14} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
                <p className={`input-quote-text ${inputCollapsed && inputLong ? "input-quote-text--collapsed" : ""}`}>
                  {result.input}
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
