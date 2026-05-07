# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinguaCheck is a React + Vite + TypeScript app that provides AI-powered English/Chinese translation, language polishing, and text analysis. Users type or select text, choose an action (explain, translate, polish, check), and receive streamed AI responses.

## Dev Commands

```bash
npm run dev      # Start dev server at 127.0.0.1
npm run build    # TypeScript compile + Vite build
npm run preview   # Preview production build
```

## Architecture

### State & Persistence

No external state library. React hooks manage all state:
- **Settings & prompts**: `localStorage` via `storage.ts` (`linguacheck.settings`, `linguacheck.customPrompts`)
- **Results**: `IndexedDB` via `storage.ts` — results survive browser restarts
- **Running state**: `useResultsWorkflow` hook manages streaming, loading states

### Data Flow

```
App.tsx
  ├── useProviderSettings → providers + active provider from localStorage
  ├── useResultsWorkflow → results, runAction (streams via api.ts)
  └── useGlobalShortcuts → keyboard shortcuts
```

### Key Files

- **api.ts** — OpenAI-compatible API calls. Tries `/chat/completions` then `/v1/chat/completions`. Supports streaming via Server-Sent Events (`data:` lines).
- **prompts.ts** — Default prompt actions (explain, enToZh, zhToEn, polish, check). Each has a `systemPrompt` that wraps user input. Custom prompts are stored separately in localStorage.
- **storage.ts** — `loadSettings`/`saveSettings` (localStorage), `loadResults`/`saveResult`/`deleteResult` (IndexedDB). Also migrates legacy settings (v0 single-provider config) to multi-provider format.
- **types.ts** — `ActionType`, `PromptAction`, `ProviderConfig`, `AssistantResult`, `Settings`

### API Provider Model

Multiple OpenAI-compatible providers can be configured. Each has `id`, `name`, `apiKey`, `baseUrl`, `model`. The `api.ts` `runPrompt()` function accepts a provider config and handles:
- Bearer token auth
- Endpoint fallback (tries `/chat/completions`, then `/v1/chat/completions`)
- Streaming with `onChunk` callback
- Error extraction from various response shapes

### Legacy Migration

`storage.ts` `normalizeSettings()` detects old config format (flat `openaiApiKey`, `openaiBaseUrl`, `ollamaBaseUrl`, etc.) and migrates to the multi-provider format transparently.