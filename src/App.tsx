import { useEffect, useMemo, useRef, useState } from "react";
import { runPrompt } from "./api";
import { savePromptActions } from "./storage";
import type { ActionType } from "./types";
import { InputPanel } from "./components/InputPanel";
import { ResultPanel } from "./components/ResultPanel";
import { ConfigPanel } from "./components/ConfigPanel";
import { useThemeMode } from "./hooks/useThemeMode";
import { useProviderSettings } from "./hooks/useProviderSettings";
import { useResultsWorkflow } from "./hooks/useResultsWorkflow";
import { useSelectionPopover } from "./hooks/useSelectionPopover";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";

function App() {
  const [input, setInput] = useState("");
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
    resultStatusFilter,
    setResultStatusFilter,
    runAction,
    rerunResult,
    toggleResult,
    deleteResult,
    togglePinResult,
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
    textareaRef.current?.focus();
  }, []);

  useGlobalShortcuts({
    promptActions,
    providers: settings.providers,
    runningAction,
    onRunAction: (type) => void handleAction(type),
    onSetInputFromClipboard: setInput,
    onClearInput: () => setInput(""),
    onSetActiveProvider: setActiveProvider,
    focusTextarea: () => textareaRef.current?.focus(),
  });

  async function handleAction(actionType: ActionType, selectionText?: string) {
    const trimmedInput = (selectionText ?? input).trim();
    if (!trimmedInput || !activeProvider) {
      return;
    }
    await runAction(actionType, trimmedInput);
  }

  function handleRestore(input: string) {
    setInput(input);
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
      <main className="workspace">
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

        <ResultPanel
          results={results}
          filteredResults={filteredResults}
          copiedResultId={copiedResultId}
          expandedResultIds={expandedResultIds}
          runningAction={runningAction}
          activeProvider={activeProvider}
          resultKeyword={resultKeyword}
          resultStatusFilter={resultStatusFilter}
          onKeywordChange={setResultKeyword}
          onStatusFilterChange={setResultStatusFilter}
          onCopyResult={(result) => void copyResultOutput(result)}
          onRerunResult={(result, newInput) => void rerunResult(result, newInput)}
          onRestoreInput={handleRestore}
          onToggleResult={toggleResult}
          onDeleteResult={deleteResult}
          onPinResult={togglePinResult}
          onExportMarkdown={exportAllResultsAsMarkdown}
          onOpenConfig={() => setActiveConfigTab("provider")}
          onClearAll={clearAllResults}
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
    </div>
  );
}

export default App;
