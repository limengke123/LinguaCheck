import { useEffect } from "react";
import type { ActionType, ProviderConfig } from "../types";
import type { PromptAction } from "../prompts";

type UseGlobalShortcutsArgs = {
  promptActions: PromptAction[];
  providers: ProviderConfig[];
  runningAction: ActionType | null;
  onRunAction: (type: ActionType) => void;
  onSetInputFromClipboard: (text: string) => void;
  onClearInput: () => void;
  onSetActiveProvider: (providerId: string) => void;
  focusTextarea: () => void;
  onOpenQuickInput: () => void;
  onTogglePreviewMode: () => void;
};

export function useGlobalShortcuts({
  promptActions,
  providers,
  runningAction,
  onRunAction,
  onSetInputFromClipboard,
  onClearInput,
  onSetActiveProvider,
  focusTextarea,
  onOpenQuickInput,
  onTogglePreviewMode,
}: UseGlobalShortcutsArgs) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const commandPressed = isMac ? event.metaKey : event.ctrlKey;

      if (commandPressed && event.key === "v" && !event.shiftKey && !event.altKey) {
        const target = event.target as HTMLElement;
        if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
          event.preventDefault();
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text) onSetInputFromClipboard(text);
              focusTextarea();
            })
            .catch(() => focusTextarea());
          return;
        }
      }

      if (commandPressed && !event.altKey && !event.shiftKey) {
        if (event.code === "KeyP" || event.key.toLowerCase() === "p") {
          event.preventDefault();
          onTogglePreviewMode();
          return;
        }
        if (event.code === "KeyO" || event.key.toLowerCase() === "o") {
          event.preventDefault();
          onOpenQuickInput();
          return;
        }
        if (event.key === "Enter") {
          if (runningAction === null && promptActions.length > 0) {
            event.preventDefault();
            onRunAction(promptActions[0].type);
          }
          return;
        }
        const actionIndex = Number(event.key) - 1;
        if (actionIndex >= 0 && actionIndex < promptActions.length) {
          if (runningAction === null) {
            event.preventDefault();
            onRunAction(promptActions[actionIndex].type);
          }
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          onClearInput();
          focusTextarea();
          return;
        }
        const index = Number(event.key) - 1;
        if (index >= 0 && index < providers.length) {
          event.preventDefault();
          onSetActiveProvider(providers[index].id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    promptActions,
    providers,
    runningAction,
    onRunAction,
    onSetInputFromClipboard,
    onClearInput,
    onSetActiveProvider,
    focusTextarea,
    onOpenQuickInput,
    onTogglePreviewMode,
  ]);
}
