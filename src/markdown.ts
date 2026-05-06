import type { AssistantResult } from "./types";

export function buildObsidianMarkdown(result: AssistantResult): string {
  return `## Sentence
${result.input}

## Meaning
${pickSection(result.output, "Meaning") || pickSection(result.output, "Translation") || ""}

## Correction
${pickSection(result.output, "Corrected Version") || pickSection(result.output, "Best Version") || ""}

## Notes
${pickSection(result.output, "Notes") || pickSection(result.output, "Reason") || result.output}

## Alternatives
${pickSection(result.output, "Alternatives") || pickSection(result.output, "Alternative") || ""}

#english #writing`;
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
