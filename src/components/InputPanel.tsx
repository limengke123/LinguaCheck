import { ArrowUp, Eraser } from "lucide-react";
import type { ActionType } from "../types";
import type { PromptAction } from "../prompts";
import * as LucideIcons from "lucide-react";

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

function getIcon(iconName?: string): React.ElementType | null {
  if (!iconName) return null;
  return (LucideIcons as unknown as Record<string, React.ElementType>)[iconName] ?? null;
}

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
  const enabledActions = promptActions.filter((a) => a.enabled !== false);

  return (
    <section className="input-panel" aria-label="Input and actions">
      <div className="composer-shell">
        <textarea
          ref={textareaRef}
          className="main-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="粘贴英文、中文或混合文本。可以是一句话、一段邮件、一段技术讨论或你想润色的表达。"
          spellCheck
        />
        <div className="composer-actions">
          {enabledActions.map((action, index) => {
            const Icon = getIcon(action.iconName);
            return (
              <button
                className={`action-chip ${runningAction === action.type ? "action-chip--running" : ""}`}
                key={action.type}
                type="button"
                onClick={() => onRunAction(action.type)}
                disabled={runningAction !== null}
                title={action.description}
              >
                {Icon && <Icon size={13} strokeWidth={2.2} />}
                <span>{action.shortLabel}</span>
                <kbd>{hotkeyPrefix}{index + 1}</kbd>
              </button>
            );
          })}
          {input.trim() && (
            <button
              className="action-send"
              type="button"
              onClick={() => {
                const defaultAction = enabledActions.find((a) => a.type === "search") ?? enabledActions[0];
                if (defaultAction) onRunAction(defaultAction.type);
              }}
              disabled={runningAction !== null}
              title="发送 (Enter)"
            >
              <ArrowUp size={15} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <div className="composer-footer">
          <span>{inputStats.words} 词 · {inputStats.chars} 字符</span>
          {input.trim() && (
            <button className="composer-clear" type="button" onClick={onClearInput}>
              <Eraser size={13} strokeWidth={2.2} />
              清空
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
