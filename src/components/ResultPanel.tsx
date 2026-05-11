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
  Volume2,
  ChevronUp,
  X,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  providers: ProviderConfig[];
  resultKeyword: string;
  resultTypeFilter: "all" | ActionType;
  onKeywordChange: (value: string) => void;
  onTypeFilterChange: (value: "all" | ActionType) => void;
  resultPinFilter: "all" | "pinned" | "unpinned";
  onPinFilterChange: (value: "all" | "pinned" | "unpinned") => void;
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
  onSetActiveProvider: (id: string) => void;
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
  providers,
  resultKeyword,
  resultTypeFilter,
  onKeywordChange,
  onTypeFilterChange,
  resultPinFilter,
  onPinFilterChange,
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
  onSetActiveProvider,
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
  const todayStr = new Date().toDateString();

  const groupedResults = useMemo(() => {
    const groups: { label: string; results: AssistantResult[] }[] = [];
    const todayItems: AssistantResult[] = [];
    const byDate: Record<string, AssistantResult[]> = {};

    for (const result of filteredResults) {
      if (result.pinned) {
        todayItems.push(result);
        continue;
      }
      const d = new Date(result.createdAt);
      const dateKey = d.toDateString();
      if (dateKey === todayStr) {
        todayItems.push(result);
      } else {
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(result);
      }
    }

    const sortedDates = Object.keys(byDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    for (const dateKey of sortedDates) {
      const d = new Date(dateKey);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      let label: string;
      if (diffDays === 1) label = "昨天";
      else if (diffDays < 7) label = `${diffDays}天前`;
      else if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) label = "本月";
      else label = `${d.getMonth() + 1}月${d.getDate()}日`;
      groups.push({ label, results: byDate[dateKey] });
    }

    return { today: todayItems, groups };
  }, [filteredResults, todayStr]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

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
        <div className="pin-filter-group">
          <button
            className={`pin-filter-button ${resultPinFilter === "all" ? "pin-filter-button--active" : ""}`}
            type="button"
            onClick={() => onPinFilterChange("all")}
          >
            全部
          </button>
          <button
            className={`pin-filter-button ${resultPinFilter === "pinned" ? "pin-filter-button--active" : ""}`}
            type="button"
            onClick={() => onPinFilterChange("pinned")}
          >
            <Pin size={13} strokeWidth={2.2} />
          </button>
          <button
            className={`pin-filter-button ${resultPinFilter === "unpinned" ? "pin-filter-button--active" : ""}`}
            type="button"
            onClick={() => onPinFilterChange("unpinned")}
          >
            <PinOff size={13} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="result-list">
        {resultsLoading ? null : filteredResults.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <svg className="empty-icon" viewBox="0 0 80 80" fill="none">
                <rect x="10" y="16" width="60" height="48" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/>
                <path d="M24 32h32M24 42h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="56" cy="52" r="10" fill="var(--accent)" opacity="0.15"/>
                <path d="M52 52h8M56 48v8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div className="empty-float-dot" />
            </div>
            <h2>准备就绪</h2>
            <p>输入内容，选择一个动作<br/>AI 会在这里输出结果</p>
            <div className="empty-shortcuts">
              <kbd>⌘O</kbd> 快速执行 &nbsp;·&nbsp; <kbd>⌘↵</kbd> 发送
            </div>
          </div>
        ) : (
          <>
            {groupedResults.today.length > 0 && (
              <div className="result-group">
                <div className="result-group-header">
                  <span className="result-group-label">Today</span>
                </div>
                {groupedResults.today.map((result, index) => (
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
                ))}
              </div>
            )}
            {groupedResults.groups.map((group) => (
              <div key={group.label} className="result-group">
                <button
                  className="result-group-header result-group-header--collapsible"
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="result-group-label">{group.label}</span>
                  <span className="result-group-count">{group.results.length}</span>
                  {collapsedGroups.has(group.label) ? (
                    <ChevronRight size={14} strokeWidth={2.2} />
                  ) : (
                    <ChevronDown size={14} strokeWidth={2.2} />
                  )}
                </button>
                {!collapsedGroups.has(group.label) && group.results.map((result, index) => (
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
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="output-footer">
        <div className="footer-left">
          {providers.length > 1 ? (
            <div className="provider-select-wrap">
              <select
                className="provider-select"
                value={activeProvider?.id ?? ""}
                onChange={(e) => onSetActiveProvider(e.target.value)}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={12} strokeWidth={2.2} />
            </div>
          ) : (
            <button
              className="footer-provider-btn"
              type="button"
              onClick={onOpenConfig}
              title="配置 Provider"
            >
              {activeProvider?.name || "点击配置 Provider"}
              <SettingsIcon size={12} strokeWidth={2.2} />
            </button>
          )}
          <span className="footer-sep">·</span>
          <span className="footer-count">
            {filteredResults.length}/{results.length} results
          </span>
          {results.length > 0 && (
            <>
              <span className="footer-sep">·</span>
              <button
                className="footer-clear-btn"
                type="button"
                onClick={onClearAll}
              >
                清空
              </button>
            </>
          )}
        </div>
        <div className="footer-actions">
          <button
            className={`button button-ghost button-compact ${previewMode ? "button--active" : ""}`}
            type="button"
            onClick={onTogglePreviewMode}
            title="Preview"
          >
            Preview <kbd className="action-kbd">⌘P</kbd>
          </button>
          <button
            className="button button-ghost button-compact"
            type="button"
            onClick={onOpenQuickInput}
            title="快速执行"
          >
            快速执行 <kbd className="action-kbd">⌘O</kbd>
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
      onClick={(e) => {
        if (expanded) return;
        const target = e.target as HTMLElement;
        if (target.closest(".result-actions") ||
            target.closest(".collapse-button") ||
            target.closest(".result-title-button") ||
            target.closest(".input-quote-header") ||
            target.closest(".input-edit-area")) {
          return;
        }
        onToggle();
      }}
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
        <div className="result-title-group">
          <button className="result-title-button" type="button" onClick={onToggle}>
            <span className="result-input-preview">
              {isLoading ? (
                <>
                  思考中<span className="loading-dots-animated"><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
                </>
              ) : (
                result.input || "(empty)"
              )}
            </span>
          </button>
          {(() => {
            const iconName = result.iconName;
            const Icon = iconName ? (LucideIcons as unknown as Record<string, React.ElementType>)[iconName] : null;
            return (
              <small className="result-meta">
                {Icon ? <Icon size={13} strokeWidth={2.2} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} /> : null}
                {result.actionLabel} · {created}
                {isLoading ? "" : ` · ${result.durationMs}ms`}
              </small>
            );
          })()}
        </div>
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
