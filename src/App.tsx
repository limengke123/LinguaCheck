import { useEffect, useMemo, useRef, useState } from "react";
import { runPrompt } from "./api";
import { savePromptActions } from "./storage";
import type { ActionType } from "./types";
import { InputPanel } from "./components/InputPanel";
import { ResultPanel } from "./components/ResultPanel";
import { ConfigPanel } from "./components/ConfigPanel";
import { CornerDownLeft, Search, X } from "lucide-react";
import { useThemeMode } from "./hooks/useThemeMode";
import { useProviderSettings } from "./hooks/useProviderSettings";
import { useResultsWorkflow } from "./hooks/useResultsWorkflow";
import { useSelectionPopover } from "./hooks/useSelectionPopover";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";

function App() {
  const [input, setInput] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [previewInputCollapsed, setPreviewInputCollapsed] = useState(false);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [quickInputValue, setQuickInputValue] = useState("");
  type ConfigTab = 'provider' | 'prompts' | 'settings';
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { darkMode, setDarkMode } = useThemeMode();
  const {
    settings,
    promptActions,
    setPromptActions,
    connectionChecks,
    activeProvider,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
    setDefaultProvider,
    handleTestProvider,
  } = useProviderSettings();
  const {
    results,
    filteredResults,
    runningAction,
    expandedResultIds,
    copiedResultId,
    resultKeyword,
    setResultKeyword,
    resultTypeFilter,
    setResultTypeFilter,
    runAction,
    rerunResult,
    toggleResult,
    deleteResult,
    togglePinResult,
    promoteTemporaryResult,
    clearAllResults,
    copyResultOutput,
    exportAllResultsAsMarkdown,
  } = useResultsWorkflow(promptActions, activeProvider, settings.providers);
  const { selection } = useSelectionPopover(textareaRef);

  const inputStats = useMemo(() => {
    const chars = input.length;
    const words = input.trim() ? input.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [input]);

  useEffect(() => {
    if (!previewMode || !previewInputCollapsed) {
      textareaRef.current?.focus();
    }
  }, [previewMode, previewInputCollapsed]);

  useGlobalShortcuts({
    promptActions,
    providers: settings.providers,
    runningAction,
    onRunAction: (type) => void handleAction(type),
    onSetInputFromClipboard: setInput,
    onClearInput: () => setInput(""),
    onSetActiveProvider: setActiveProvider,
    focusTextarea: () => textareaRef.current?.focus(),
    onOpenQuickInput: () => {
      setQuickInputValue(input);
      setShowQuickInput(true);
    },
  });

  useEffect(() => {
    if (!previewMode) {
      setPreviewInputCollapsed(false);
      setShowQuickInput(false);
    }
  }, [previewMode]);

  useEffect(() => {
    const compactOutput = localStorage.getItem("linguacheck.compactOutput") === "1";
    document.documentElement.classList.toggle("compact-output", compactOutput);
  }, []);

  async function handleAction(actionType: ActionType, selectionText?: string) {
    const trimmedInput = (selectionText ?? input).trim();
    if (!trimmedInput || !activeProvider) {
      return;
    }
    await runAction(actionType, trimmedInput);
    if (!selectionText) {
      setInput("");
    }
  }

  async function handleQuickRun(actionType?: ActionType) {
    const source = quickInputValue.trim();
    if (!source || !activeProvider || runningAction !== null) {
      return;
    }
    const fallbackAction = promptActions.find((action) => action.type === "search")?.type ?? promptActions[0]?.type;
    const targetAction = actionType ?? fallbackAction;
    if (!targetAction) {
      return;
    }
    setShowQuickInput(false);
    setQuickInputValue("");
    await runAction(targetAction, source, true);
  }

  function handleRestore(input: string) {
    setInput(input);
    if (previewMode) {
      setPreviewInputCollapsed(false);
    }
    textareaRef.current?.focus();
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
      <main className={`workspace ${previewMode && previewInputCollapsed ? "workspace--preview-focused" : ""}`}>
        {previewMode && previewInputCollapsed ? null : (
          <InputPanel
            input={input}
            inputStats={inputStats}
            runningAction={runningAction}
            promptActions={promptActions}
            onInputChange={setInput}
            onClearInput={() => setInput("")}
            onRunAction={(actionType) => void handleAction(actionType)}
            textareaRef={textareaRef}
          />
        )}

        <ResultPanel
          results={results}
          filteredResults={filteredResults}
          copiedResultId={copiedResultId}
          expandedResultIds={expandedResultIds}
          runningAction={runningAction}
          activeProvider={activeProvider}
          resultKeyword={resultKeyword}
          resultTypeFilter={resultTypeFilter}
          onKeywordChange={setResultKeyword}
          onTypeFilterChange={setResultTypeFilter}
          onCopyResult={(result) => void copyResultOutput(result)}
          onRerunResult={(result, newInput) => void rerunResult(result, newInput)}
          onRestoreInput={handleRestore}
          onToggleResult={toggleResult}
          onDeleteResult={deleteResult}
          onPinResult={togglePinResult}
          onPromoteTemporaryResult={promoteTemporaryResult}
          onExportMarkdown={exportAllResultsAsMarkdown}
          onOpenConfig={() => setActiveConfigTab("provider")}
          onClearAll={clearAllResults}
          previewMode={previewMode}
          onTogglePreviewMode={() => {
            setPreviewMode((current) => {
              const next = !current;
              if (next) {
                setPreviewInputCollapsed(true);
              }
              return next;
            });
          }}
          onOpenQuickInput={() => {
            setQuickInputValue(input);
            setShowQuickInput(true);
          }}
        />
      </main>

      {activeConfigTab !== null ? (
        <ConfigPanel
          activeTab={activeConfigTab}
          connectionChecks={connectionChecks}
          settings={settings}
          promptActions={promptActions}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
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

      {showQuickInput ? (
        <div className="modal-backdrop modal-backdrop--spotlight" onClick={(event) => event.target === event.currentTarget && setShowQuickInput(false)}>
          <section className="quick-input-spotlight" role="dialog" aria-modal="true" aria-label="Quick input">
            <header className="quick-input-spotlight-header">
              <h3>Quick Run</h3>
              <span className="quick-input-shortcut">⌘P</span>
              <button className="icon-button" type="button" onClick={() => setShowQuickInput(false)} aria-label="Close quick input">
                <X size={15} strokeWidth={2.4} />
              </button>
            </header>
            <input
              className="quick-input-line"
              value={quickInputValue}
              onChange={(event) => setQuickInputValue(event.target.value)}
              placeholder="输入文本后回车，自动选择合适的 Prompt"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setShowQuickInput(false);
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleQuickRun();
                }
              }}
            />
            <div className="quick-input-spotlight-actions">
              <button className="button button-ghost" type="button" onClick={() => setShowQuickInput(false)}>
                取消
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void handleQuickRun()}
                disabled={!quickInputValue.trim() || runningAction !== null}
              >
                <Search size={14} strokeWidth={2.4} />
                搜索
              </button>
              {promptActions.slice(0, 3).map((action) => (
                <button
                  key={action.id}
                  className="button button-ghost button-compact"
                  type="button"
                  onClick={() => void handleQuickRun(action.type)}
                  disabled={!quickInputValue.trim() || runningAction !== null}
                  title={action.label}
                >
                  <CornerDownLeft size={13} strokeWidth={2.3} />
                  {action.shortLabel}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
