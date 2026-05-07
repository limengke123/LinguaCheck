import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bookmark,
  Circle,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownLeft,
  Download,
  Edit2,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Trash2,
  X,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActionType, AssistantResult, ProviderConfig } from "../types";
import { CustomSelect } from "./CustomSelect";

type ResultPanelProps = {
  results: AssistantResult[];
  filteredResults: AssistantResult[];
  copiedResultId: string | null;
  expandedResultIds: Set<string>;
  runningAction: ActionType | null;
  resultsLoading: boolean;
  activeProvider: ProviderConfig | undefined;
  resultKeyword: string;
  resultTypeFilter: "all" | ActionType;
  onKeywordChange: (value: string) => void;
  onTypeFilterChange: (value: "all" | ActionType) => void;
  onCopyResult: (result: AssistantResult) => void;
  onRerunResult: (result: AssistantResult, newInput?: string) => void;
  onRestoreInput: (input: string) => void;
  onToggleResult: (id: string) => void;
  onDeleteResult: (id: string) => void;
  onPinResult: (id: string) => void;
  onPromoteTemporaryResult: (id: string) => void;
  onExportMarkdown: () => void;
  onOpenConfig: () => void;
  onClearAll: () => void;
  previewMode: boolean;
  onTogglePreviewMode: () => void;
  onOpenQuickInput: () => void;
};

export function ResultPanel({
  results,
  filteredResults,
  copiedResultId,
  expandedResultIds,
  runningAction,
  resultsLoading,
  activeProvider,
  resultKeyword,
  resultTypeFilter,
  onKeywordChange,
  onTypeFilterChange,
  onCopyResult,
  onRerunResult,
  onRestoreInput,
  onToggleResult,
  onDeleteResult,
  onPinResult,
  onPromoteTemporaryResult,
  onExportMarkdown,
  onOpenConfig,
  onClearAll,
  previewMode,
  onTogglePreviewMode,
  onOpenQuickInput,
}: ResultPanelProps) {
  const typeOptions = [
    { value: "all", label: "全部类型" },
    ...Array.from(new Map(results.map((item) => [item.action, item.actionLabel])).entries()).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  return (
    <section className="output-panel" aria-label="Output cards">
      <div className="result-toolbar">
        {previewMode ? (
          <span className="preview-mode-pill">
            <Circle size={8} />
            Preview
          </span>
        ) : null}
        <label className="search-input">
          <Search size={14} strokeWidth={2.4} />
          <input
            value={resultKeyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="搜索输入/输出/错误..."
          />
        </label>
        <CustomSelect
          className="status-filter"
          value={resultTypeFilter}
          options={typeOptions}
          onChange={(value) => onTypeFilterChange(value as "all" | ActionType)}
        />
      </div>

      <div className="result-list">
        {resultsLoading ? null : filteredResults.length === 0 ? (
          <div className="empty-state">
            <h2>等待输出</h2>
            <p>输入文本并选择一个动作，结果会以 Markdown 卡片保留在这里。你也可以通过上方搜索和状态筛选快速定位历史记录。</p>
          </div>
        ) : (
          filteredResults.map((result, index) => (
            <ResultCard
              index={index + 1}
              copied={copiedResultId === result.id}
              expanded={expandedResultIds.has(result.id)}
              key={result.id}
              result={result}
              running={runningAction !== null}
              onCopy={() => onCopyResult(result)}
              onRerun={(newInput) => onRerunResult(result, newInput)}
              onRestore={(input) => onRestoreInput(input)}
              onToggle={() => onToggleResult(result.id)}
              onDelete={() => onDeleteResult(result.id)}
              onPinToggle={() => onPinResult(result.id)}
              onPromoteTemporary={result.temporary ? () => onPromoteTemporaryResult(result.id) : undefined}
            />
          ))
        )}
      </div>

      <div className="output-footer">
        <div className="footer-left">
          <span className="footer-provider">{activeProvider?.name || "No provider"}</span>
          <span className="footer-sep">·</span>
          <span className="footer-count">
            {filteredResults.length}/{results.length} results
          </span>
        </div>
        <div className="footer-actions">
          <button
            className={`button button-ghost button-compact ${previewMode ? "button--active" : ""}`}
            type="button"
            onClick={onTogglePreviewMode}
            title="Preview mode"
          >
            Preview
          </button>
          <button
            className="button button-ghost button-compact"
            type="button"
            onClick={onOpenQuickInput}
            title="⌘P"
          >
            ⌘P 快速执行
          </button>
          <button
            className="button button-ghost button-compact"
            type="button"
            disabled={results.length === 0}
            onClick={onExportMarkdown}
          >
            <Download size={14} strokeWidth={2.4} />
            导出 MD
          </button>
          <a
            className="icon-button footer-settings"
            href="https://github.com/limengke123/LinguaCheck"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            aria-label="View on GitHub"
            style={{ display: "grid" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <button
            className="icon-button footer-settings"
            type="button"
            onClick={onOpenConfig}
            title="Provider settings"
            aria-label="Provider settings"
          >
            <SettingsIcon size={15} strokeWidth={2} />
          </button>
          <button
            className="button button-ghost button-compact"
            type="button"
            disabled={results.length === 0}
            onClick={onClearAll}
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}

type ResultCardProps = {
  index: number;
  copied: boolean;
  expanded: boolean;
  result: AssistantResult;
  running: boolean;
  onCopy: () => void;
  onRerun: (newInput?: string) => void;
  onRestore: (input: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onPinToggle: () => void;
  onPromoteTemporary?: () => void;
};

function ResultCard({
  index,
  copied,
  expanded,
  result,
  running,
  onCopy,
  onRerun,
  onRestore,
  onToggle,
  onDelete,
  onPinToggle,
  onPromoteTemporary,
}: ResultCardProps) {
  const [inputCollapsed, setInputCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedInput, setEditedInput] = useState(result.input);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const streamTailRef = useRef<HTMLDivElement>(null);
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
      const textarea = editTextareaRef.current;
      if (textarea) {
        textarea.focus();
        const caretPos = textarea.value.length;
        textarea.setSelectionRange(caretPos, caretPos);
      }
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
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, editedInput, result.input, onRerun]);

  useEffect(() => {
    if (!expanded) {
      setInputCollapsed(true);
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !isLoading || !result.output) return;
    streamTailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [expanded, isLoading, result.output]);

  return (
    <article
      className={
        (result.status === "error"
          ? "result-card result-card--error"
          : isLoading
            ? "result-card result-card--loading"
            : expanded
              ? "result-card"
              : "result-card result-card--collapsed") +
        (result.temporary ? " result-card--temporary" : "")
      }
    >
      <header className="result-card-header">
        <span className="result-index">#{index}</span>
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
          {(() => {
            const iconName = result.iconName;
            const Icon = iconName ? (LucideIcons as unknown as Record<string, React.ElementType>)[iconName] : null;
            return Icon ? <Icon size={13} strokeWidth={2.2} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} /> : null;
          })()}
          <span className="result-input-preview">{isLoading ? "思考中..." : result.input || "(empty)"}</span>
          <small>
            {result.actionLabel} · {created}
            {isLoading ? "" : ` · ${result.durationMs}ms`}
          </small>
        </button>
        {!isLoading && (
          <div className="result-actions">
            {result.temporary && onPromoteTemporary ? (
              <button
                className="icon-button result-icon-button"
                type="button"
                onClick={onPromoteTemporary}
                title="Keep"
                aria-label="Keep result"
              >
                <Bookmark size={15} strokeWidth={2.2} />
              </button>
            ) : null}
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
              onClick={onPinToggle}
              title={result.pinned ? "取消置顶" : "置顶"}
              aria-label={result.pinned ? "Unpin" : "Pin"}
            >
              {result.pinned ? <PinOff size={15} strokeWidth={2.2} /> : <Pin size={15} strokeWidth={2.2} />}
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
                <div className="input-quote-header" onClick={() => setInputCollapsed((v) => !v)}>
                  <span>Input</span>
                  <div className="input-quote-header-actions">
                    {inputLong ? (
                      <button
                        className="icon-button"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInputCollapsed((v) => !v);
                        }}
                        title={inputCollapsed ? "Show more" : "Show less"}
                        aria-label={inputCollapsed ? "Show more" : "Show less"}
                      >
                        {inputCollapsed ? <ChevronDown size={14} strokeWidth={2.2} /> : <ChevronRight size={14} strokeWidth={2.2} />}
                      </button>
                    ) : null}
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
                <p className={`input-quote-text ${inputCollapsed && inputLong ? "input-quote-text--collapsed" : ""}`}>{result.input}</p>
              </blockquote>
            )
          ) : null}

          {result.status === "loading" ? (
            <>
              <div className="result-loading">
                <span className="loading-core">思考中</span>
                <span className="loading-dots" aria-hidden="true" />
              </div>
              {result.output ? (
                <div className="markdown-block markdown-block--streaming">
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.output}</ReactMarkdown>
                    <div ref={streamTailRef} />
                  </div>
                </div>
              ) : null}
            </>
          ) : result.error ? (
            <div className="result-error">{result.error}</div>
          ) : (
            <div className="markdown-block">
              <button className="icon-button copy-block-button" type="button" onClick={onCopy} title="Copy output" aria-label="Copy output">
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
