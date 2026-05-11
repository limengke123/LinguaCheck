import { useEffect, useMemo, useRef, useState } from "react";
import { runPrompt } from "../api";
import { buildPrompt } from "../prompts";
import { clearResults as dbClearResults, deleteResult as dbDeleteResult, loadResults, saveResult } from "../storage";
import type { PromptAction } from "../prompts";
import type { ActionType, AssistantResult, ProviderConfig } from "../types";

type ResultTypeFilter = "all" | ActionType;
type ResultPinFilter = "all" | "pinned" | "unpinned";

const EXPANDED_IDS_KEY = "linguacheck.expandedIds";

function loadExpandedIds(): Set<string> | null {
  try {
    const raw = localStorage.getItem(EXPANDED_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveExpandedIds(ids: Set<string>) {
  localStorage.setItem(EXPANDED_IDS_KEY, JSON.stringify([...ids]));
}

export function useResultsWorkflow(
  promptActions: PromptAction[],
  activeProvider: ProviderConfig | undefined,
  providers: ProviderConfig[],
) {
  const [results, setResults] = useState<AssistantResult[]>([]);
  const [runningAction, setRunningAction] = useState<ActionType | null>(null);
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(() => new Set());
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null);
  const [resultKeyword, setResultKeyword] = useState("");
  const [resultTypeFilter, setResultTypeFilter] = useState<ResultTypeFilter>("all");
  const [resultPinFilter, setResultPinFilter] = useState<ResultPinFilter>("all");
  const [resultsLoading, setResultsLoading] = useState(true);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    loadResults()
      .then((loaded) => {
        setResultsLoading(false);
        if (loaded.length > 0) {
          setResults(loaded);
          const savedExpanded = loadExpandedIds();
          if (savedExpanded !== null) {
            setExpandedResultIds(savedExpanded);
          } else if (loaded[0]) {
            setExpandedResultIds(new Set([loaded[0].id]));
          }
        }
        isInitializedRef.current = true;
      })
      .catch(() => {
        setResultsLoading(false);
        isInitializedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    saveExpandedIds(expandedResultIds);
  }, [expandedResultIds]);

  const filteredResults = useMemo(() => {
    const keyword = resultKeyword.trim().toLowerCase();
    return results
      .filter((result) => {
        const matchesKeyword =
          !keyword ||
          result.input.toLowerCase().includes(keyword) ||
          result.output.toLowerCase().includes(keyword) ||
          (result.error?.toLowerCase().includes(keyword) ?? false);
        const matchesType = resultTypeFilter === "all" || result.action === resultTypeFilter;
        const matchesPin = resultPinFilter === "all" || (resultPinFilter === "pinned" ? result.pinned : !result.pinned);
        return matchesKeyword && matchesType && matchesPin;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [resultKeyword, resultTypeFilter, resultPinFilter, results]);

  async function runAction(actionType: ActionType, sourceInput: string, temporary = false) {
    const action = promptActions.find((item) => item.type === actionType);
    if (!action || !activeProvider) return;
    const startedAt = performance.now();
    setRunningAction(action.type);
    setCopiedResultId(null);

    const resultId = crypto.randomUUID();
    const newResult: AssistantResult = {
      id: resultId,
      action: action.type,
      actionLabel: action.label,
      providerId: activeProvider.id,
      providerName: activeProvider.name,
      input: sourceInput,
      output: "",
      createdAt: new Date().toISOString(),
      durationMs: 0,
      status: "loading",
      iconName: action.iconName,
      temporary,
    };
    setResults((current) => [newResult, ...current]);
    setExpandedResultIds(new Set([resultId]));
    if (!temporary) {
      void saveResult(newResult);
    }

    try {
      const output = await runPrompt(
        activeProvider,
        buildPrompt(action, sourceInput),
        (chunk) => {
          setResults((current) =>
            current.map((r) => (r.id === resultId ? { ...r, output: r.output + chunk } : r)),
          );
        },
      );
      const finalResult: AssistantResult = {
        ...newResult,
        output,
        durationMs: Math.round(performance.now() - startedAt),
        status: "done",
      };
      setResults((current) => current.map((r) => (r.id === resultId ? finalResult : r)));
      if (!temporary) {
        void saveResult(finalResult);
      }
    } catch (error) {
      const errorResult: AssistantResult = {
        ...newResult,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "请求失败。",
        status: "error",
      };
      setResults((current) => current.map((r) => (r.id === resultId ? errorResult : r)));
      if (!temporary) {
        void saveResult(errorResult);
      }
    } finally {
      setRunningAction(null);
    }
  }

  async function rerunResult(result: AssistantResult, newInput?: string) {
    const originalProvider = providers.find((provider) => provider.id === result.providerId) ?? activeProvider;
    const inputToUse = newInput ?? result.input;
    if (!inputToUse.trim() || !originalProvider) return;
    const action = promptActions.find((item) => item.type === result.action);
    if (!action) return;

    const startedAt = performance.now();
    setRunningAction(result.action);
    setCopiedResultId(null);

    const loadingResult: AssistantResult = {
      ...result,
      input: inputToUse,
      output: "",
      error: undefined,
      durationMs: 0,
      status: "loading",
    };
    setResults((current) => current.map((r) => (r.id === result.id ? loadingResult : r)));
    void saveResult(loadingResult);

    try {
      const output = await runPrompt(
        originalProvider,
        buildPrompt(action, inputToUse),
        (chunk) => {
          setResults((current) =>
            current.map((r) => (r.id === result.id ? { ...r, output: r.output + chunk } : r)),
          );
        },
      );
      const finalResult: AssistantResult = {
        ...loadingResult,
        output,
        durationMs: Math.round(performance.now() - startedAt),
        status: "done",
      };
      setResults((current) => current.map((r) => (r.id === result.id ? finalResult : r)));
      void saveResult(finalResult);
    } catch (error) {
      const errorResult: AssistantResult = {
        ...loadingResult,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "请求失败。",
        status: "error",
      };
      setResults((current) => current.map((r) => (r.id === result.id ? errorResult : r)));
      void saveResult(errorResult);
    } finally {
      setRunningAction(null);
    }
  }

  function toggleResult(resultId: string) {
    setExpandedResultIds((current) => {
      const next = new Set(current);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  }

  function deleteResult(resultId: string) {
    setResults((current) => current.filter((r) => r.id !== resultId));
    setExpandedResultIds((current) => {
      const next = new Set(current);
      next.delete(resultId);
      return next;
    });
    void dbDeleteResult(resultId);
  }

  function togglePinResult(resultId: string) {
    setResults((current) => {
      let updated: AssistantResult | null = null;
      const next = current.map((result) => {
        if (result.id !== resultId) return result;
        updated = { ...result, pinned: !result.pinned };
        return updated;
      });
      if (updated) void saveResult(updated);
      return next;
    });
  }

  function promoteTemporaryResult(resultId: string) {
    setResults((current) => {
      const result = current.find((r) => r.id === resultId);
      if (!result || !result.temporary) return current;
      const promoted = { ...result, temporary: false };
      void saveResult(promoted);
      return current.map((r) => (r.id === resultId ? promoted : r));
    });
  }

  function clearAllResults() {
    setResults([]);
    setExpandedResultIds(new Set());
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

  function exportAllResultsAsMarkdown() {
    if (results.length === 0) return;
    const content = results
      .map((result) => {
        const title = `## ${result.actionLabel} · ${result.providerName}`;
        const meta = `- Time: ${result.createdAt}\n- Duration: ${result.durationMs}ms\n- Status: ${result.status}`;
        const body = result.error
          ? `### Error\n\n${result.error}`
          : `### Input\n\n${result.input}\n\n### Output\n\n${result.output}`;
        return `${title}\n${meta}\n\n${body}`;
      })
      .join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `linguacheck-results-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    results,
    filteredResults,
    runningAction,
    resultsLoading,
    expandedResultIds,
    copiedResultId,
    resultKeyword,
    setResultKeyword,
    resultTypeFilter,
    setResultTypeFilter,
    resultPinFilter,
    setResultPinFilter,
    runAction,
    rerunResult,
    toggleResult,
    deleteResult,
    togglePinResult,
    promoteTemporaryResult,
    clearAllResults,
    copyResultOutput,
    exportAllResultsAsMarkdown,
  };
}
