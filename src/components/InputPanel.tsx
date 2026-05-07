import { Eraser, Sparkles } from "lucide-react";
import type { ActionType } from "../types";
import type { PromptAction } from "../prompts";

type InputPanelProps = {
  input: string;
  inputStats: { words: number; chars: number };
  runningAction: ActionType | null;
  promptActions: PromptAction[];
  onInputChange: (value: string) => void;
  onClearInput: () => void;
  onRunAction: (actionType: ActionType) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

export function InputPanel({
  input,
  inputStats,
  runningAction,
  promptActions,
  onInputChange,
  onClearInput,
  onRunAction,
  textareaRef,
}: InputPanelProps) {
  const isMac = navigator.platform.includes("Mac");
  const hotkeyPrefix = isMac ? "⌘" : "Ctrl";

  return (
    <section className="input-panel" aria-label="Input and actions">
      <div className="hero-bar">
        <div className="hero-title">
          <Sparkles size={16} strokeWidth={2.2} />
          <strong>LinguaCheck</strong>
          <span>AI Writing Copilot</span>
        </div>
        <button
          className="button button-ghost button-compact"
          type="button"
          onClick={onClearInput}
          disabled={!input.trim()}
        >
          <Eraser size={14} strokeWidth={2.4} />
          清空输入
        </button>
      </div>

      <div className="composer-shell">
        <textarea
          ref={textareaRef}
          className="main-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="粘贴英文、中文或混合文本。可以是一句话、一段邮件、一段技术讨论或你想润色的表达。"
          spellCheck
        />
      </div>

      <div className="input-stats">
        <span>{inputStats.words} 词</span>
        <span>{inputStats.chars} 字符</span>
      </div>

      <span className="action-grid-title">Actions</span>
      <div className="action-grid" aria-label="Prompt actions">
        {promptActions.map((action, index) => (
          <button
            className="button action-button"
            key={action.type}
            type="button"
            onClick={() => onRunAction(action.type)}
            disabled={runningAction !== null}
            title={`${action.description} (${hotkeyPrefix}${index + 1})`}
          >
            <span className="action-label">
              {runningAction === action.type ? "Running" : action.shortLabel}
              <kbd className="action-kbd">
                {hotkeyPrefix}
                {index + 1}
              </kbd>
            </span>
            <small>{action.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
