import { useEffect, useState } from "react";

type SelectionState = {
  text: string;
  source: "input" | "output";
  x: number;
  y: number;
} | null;

export function useSelectionPopover(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [selection, setSelection] = useState<SelectionState>(null);

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
      const textarea = textareaRef.current;
      if (textarea && textarea.contains(anchor)) {
        setSelection({ text, source: "input", x: 0, y: 0 });
        return;
      }
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
      const textarea = textareaRef.current;
      if (textarea && textarea.contains(anchor)) {
        setSelection({ text, source: "input", x: rect.left + rect.width / 2, y: rect.top });
        return;
      }
      const outputEl = document.querySelector(".output-panel");
      if (outputEl && outputEl.contains(anchor)) {
        setSelection({ text, source: "output", x: rect.left + rect.width / 2, y: rect.top });
        return;
      }
      setSelection(null);
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isInInput = textareaRef.current?.contains(target);
      const isInOutput = document.querySelector(".output-panel")?.contains(target);
      const isInSelectionBar = document.querySelector(".selection-bar")?.contains(target);
      if (!isInInput && !isInOutput && !isInSelectionBar) {
        setSelection(null);
      }
    }

    function handleBlur() {
      setSelection(null);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("blur", handleBlur);
    };
  }, [textareaRef]);

  return { selection, setSelection };
}
