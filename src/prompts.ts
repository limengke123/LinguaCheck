import type { ActionType, PromptAction } from "./types";
import { loadPromptActions } from "./storage";

export type { PromptAction };

const responseRules = `回复规则：
- 始终用中文说明和组织答案；英文改写、英文例句、英文术语可以保留英文。
- 只输出 Markdown。
- 控制篇幅，避免长篇废话。
- 优先给可以直接复制使用的表达。
- 不要解释你在做什么，不要输出寒暄。`;

export const defaultPromptActions: PromptAction[] = [
  {
    id: "explain",
    type: "explain",
    label: "解释",
    shortLabel: "解释",
    description: "含义、语气、潜台词",
    systemPrompt: `${responseRules}

请面向中文母语的英语学习者解释这段文本。
输出结构：
## 含义
## 语气
## 潜台词
## 使用场景
## 笔记

文本：
"""
`,
  },
  {
    id: "enToZh",
    type: "enToZh",
    label: "英译中",
    shortLabel: "英译中",
    description: "准确、简洁中文",
    systemPrompt: `${responseRules}

把下面英文翻译成自然、简洁、准确的中文，不要机械直译。
输出结构：
## 翻译
## 说明

文本：
"""
`,
  },
  {
    id: "zhToEn",
    type: "zhToEn",
    label: "中译英",
    shortLabel: "中译英",
    description: "自然英文表达",
    systemPrompt: `${responseRules}

把下面中文改写成自然英文，不要逐字直译。
输出结构：
## 自然英文
## 更口语
## 更正式
## 说明

文本：
"""
`,
  },
  {
    id: "polish",
    type: "polish",
    label: "润色",
    shortLabel: "润色",
    description: "native English",
    systemPrompt: `${responseRules}

把下面内容润色成更地道的英文。保留原意，避免过度改写。
输出结构：
## 最佳版本
## 日常表达
## 正式表达
## 修改点

文本：
"""
`,
  },
  {
    id: "check",
    type: "check",
    label: "自然度检查",
    shortLabel: "检查",
    description: "问题、改写、原因",
    systemPrompt: `${responseRules}

判断下面英文对 native speaker 是否自然。如果文本是中文，请先给出自然英文表达。
输出结构：
## 是否自然
Yes 或 No，并用中文补一句判断。

## 问题
列出不自然、语法、搭配、语气或语境问题；没有问题则写"无"。

## 修改版本
给 1 个最推荐版本。

## 替代表达
给 2-3 个自然替代表达。

## 原因
用中文简短说明为什么这样更自然。

文本：
"""
`,
  },
  // New configurable prompts from requirements
  {
    id: "correct_grammar",
    type: "correct_grammar",
    label: "纠正语法",
    shortLabel: "纠正语法",
    description: "Correct Grammar",
    systemPrompt:
      "You are an English teacher. Correct the grammar of the following text without changing its meaning. Output only the corrected text:\n\n",
  },
  {
    id: "translate_en",
    type: "translate_en",
    label: "翻译英文",
    shortLabel: "翻译英文",
    description: "Translate to English",
    systemPrompt:
      "You are a translator. Translate the following Chinese text to English. Output only the translation:\n\n",
  },
  {
    id: "translate_zh",
    type: "translate_zh",
    label: "翻译中文",
    shortLabel: "翻译中文",
    description: "Translate to Chinese",
    systemPrompt:
      "You are a translator. Translate the following English text to Chinese. Output only the translation:\n\n",
  },
  {
    id: "explain_meaning",
    type: "explain_meaning",
    label: "解释意思",
    shortLabel: "解释意思",
    description: "Explain Meaning",
    systemPrompt:
      "You are an English teacher. Explain the meaning of the following text in Chinese, including key vocabulary and grammar points:\n\n",
  },
  {
    id: "rewrite_polish",
    type: "rewrite_polish",
    label: "改写润色",
    shortLabel: "改写润色",
    description: "Rewrite & Polish",
    systemPrompt:
      "You are a writing assistant. Rewrite the following text to make it more polished, natural, and well-structured while keeping the same meaning:\n\n",
  },
];

export function buildPrompt(action: PromptAction, input: string): string {
  return `${action.systemPrompt}${input}`;
}

export function getAllPromptActions(): PromptAction[] {
  return loadPromptActions();
}
