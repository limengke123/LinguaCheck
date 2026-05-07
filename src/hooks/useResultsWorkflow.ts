import { useEffect, useMemo, useState } from "react";
import { runPrompt } from "../api";
import { buildPrompt } from "../prompts";
import { clearResults as dbClearResults, deleteResult as dbDeleteResult, loadResults, saveResult } from "../storage";
import type { PromptAction } from "../prompts";
import type { ActionType, AssistantResult, ProviderConfig } from "../types";

type ResultStatusFilter = "all" | "done" | "error" | "loading";

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
  const [resultStatusFilter, setResultStatusFilter] = useState<ResultStatusFilter>("all");

  useEffect(() => {
    loadResults()
      .then((loaded) => {
        if (loaded.length > 0) {
          setResults(loaded);
          if (loaded[0]) {
            setExpandedResultIds(new Set([loaded[0].id]));
          }
        }
      })
      .catch(() => undefined);
  }, []);

  const filteredResults = useMemo(() => {
    const keyword = resultKeyword.trim().toLowerCase();
    return results
      .filter((result) => {
        const matchesKeyword =
          !keyword ||
          result.input.toLowerCase().includes(keyword) ||
          result.output.toLowerCase().includes(keyword) ||
          (result.error?.toLowerCase().includes(keyword) ?? false);
        const matchesStatus =
          resultStatusFilter === "all" || result.status === resultStatusFilter;
        return matchesKeyword && matchesStatus;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [resultKeyword, resultStatusFilter, results]);

  async function runAction(actionType: ActionType, sourceInput: string) {
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
    };
    setResults((current) => [newResult, ...current]);
    setExpandedResultIds(new Set([resultId]));
    void saveResult(newResult);

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
      void saveResult(finalResult);
    } catch (error) {
      const errorResult: AssistantResult = {
        ...newResult,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "请求失败。",
        status: "error",
      };
      setResults((current) => current.map((r) => (r.id === resultId ? errorResult : r)));
      void saveResult(errorResult);
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

  function clearAllResults() {
    setResults([]);
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
  };
}
