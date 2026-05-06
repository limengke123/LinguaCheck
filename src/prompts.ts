import type { ActionType } from "./types";

export type PromptAction = {
  type: ActionType;
  label: string;
  shortLabel: string;
  description: string;
  buildPrompt: (input: string) => string;
};

const responseRules = `Rules:
- Return Markdown only.
- Keep the answer concise.
- Prefer immediately copyable wording.
- Do not add filler or meta commentary.`;

export const promptActions: PromptAction[] = [
  {
    type: "explain",
    label: "Explain",
    shortLabel: "Explain",
    description: "Meaning, tone, subtext",
    buildPrompt: (input) => `${responseRules}

Explain this text for an English learner.
Return:
## Meaning
## Tone
## Subtext
## Notes

Text:
"""
${input}
"""`,
  },
  {
    type: "enToZh",
    label: "EN -> ZH",
    shortLabel: "EN -> ZH",
    description: "Accurate Chinese translation",
    buildPrompt: (input) => `${responseRules}

Translate the English text into concise, natural Chinese.
Return:
## Translation
## Notes

Text:
"""
${input}
"""`,
  },
  {
    type: "zhToEn",
    label: "ZH -> EN",
    shortLabel: "ZH -> EN",
    description: "Natural English expression",
    buildPrompt: (input) => `${responseRules}

Translate the Chinese text into natural English. Do not translate word by word.
Return:
## Natural English
## Alternative
## Notes

Text:
"""
${input}
"""`,
  },
  {
    type: "polish",
    label: "Polish",
    shortLabel: "Polish",
    description: "Native casual and formal versions",
    buildPrompt: (input) => `${responseRules}

Rewrite this text in native English.
Return:
## Best Version
## Casual
## Formal
## Notes

Text:
"""
${input}
"""`,
  },
  {
    type: "check",
    label: "Naturalness Check",
    shortLabel: "Check",
    description: "Naturalness, fixes, alternatives",
    buildPrompt: (input) => `${responseRules}

Evaluate whether this sentence is natural for a native English speaker.
Return:
## Natural
Yes or No

## Problems
List the problems if any. If none, write "None."

## Corrected Version
One best corrected version.

## Alternatives
2-3 natural alternatives.

## Reason
One brief reason.

Sentence:
"""
${input}
"""`,
  },
];
