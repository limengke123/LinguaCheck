import type { AssistantResult } from "./types";

export function buildObsidianMarkdown(result: AssistantResult): string {
  return `## Sentence
${result.input}

## Meaning
${pickAnySection(result.output, ["含义", "翻译", "Meaning", "Translation"]) || ""}

## Correction
${pickAnySection(result.output, ["修改版本", "最佳版本", "自然英文", "Corrected Version", "Best Version"]) || ""}

## Notes
${pickAnySection(result.output, ["笔记", "说明", "修改点", "原因", "Notes", "Reason"]) || result.output}

## Alternatives
${pickAnySection(result.output, ["替代表达", "更口语", "更正式", "Alternatives", "Alternative"]) || ""}

#english #writing`;
}

function pickAnySection(markdown: string, headings: string[]): string {
  for (const heading of headings) {
    const value = pickSection(markdown, heading);
    if (value) {
      return value;
    }
  }

  return "";
}

function pickSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `^##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "im",
  );
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
