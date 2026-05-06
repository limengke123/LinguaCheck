# LinguaCheck

LinguaCheck is a pure frontend AI English assistant for reading, writing checks, translation, polishing, naturalness review, and Obsidian Markdown export.

It runs entirely in the browser. There is no backend, database, login system, or server-side API proxy.

## Features

- Single text input for English, Chinese, or mixed text
- Prompt actions: Explain, EN -> ZH, ZH -> EN, Polish, Naturalness Check
- OpenAI-compatible API support
- Ollama local model support
- Model switching with `Cmd + 1` and `Cmd + 2`
- Result cards that keep previous outputs instead of overwriting them
- API key, base URL, and model config stored in `localStorage`
- Copy latest successful result as Obsidian-friendly Markdown

## Requirements

- Node.js LTS is recommended
- npm
- Optional: Ollama, if you want to use local models

## Local Development

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

If port `5173` is already in use, run:

```bash
npm run dev -- --port 5174
```

Then open:

```text
http://127.0.0.1:5174/
```

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

The preview server will print the local URL in the terminal.

## Model Configuration

Open the app and fill in the provider settings.

For OpenAI-compatible APIs:

- API Key: required for remote providers; optional for local providers such as oMLX
- Base URL: defaults to `https://api.openai.com/v1`
- Model: required, for example your chosen OpenAI-compatible model name

### oMLX

oMLX exposes an OpenAI-compatible API, not an Ollama API. Use the `OpenAI-compatible` provider in LinguaCheck.

Recommended settings:

```text
Provider: OpenAI-compatible
API Key: leave empty
Base URL: http://localhost:8099/v1
Model: Qwen3.6-35B-A3B-4bit
```

LinguaCheck also accepts this base URL and will retry with `/v1` automatically if the root endpoint returns `404`:

```text
http://localhost:8099
```

Do not put oMLX under the `Ollama` provider. The Ollama provider calls `/api/generate`, while oMLX uses `/v1/chat/completions`.

For Ollama:

- Base URL: defaults to `http://localhost:11434`
- Model: required, for example a model you have pulled locally

Example Ollama setup:

```bash
ollama pull llama3.1
ollama serve
```

Then set the Ollama model field in the UI to:

```text
llama3.1
```

## Browser Notes

Because this app is pure frontend, requests are sent directly from the browser.

- OpenAI-compatible providers must allow browser CORS requests.
- Ollama must be running locally for Ollama mode.
- API keys are stored in browser `localStorage`, as required by the MVP.

## Obsidian Export

After a successful result, click `Copy Markdown`.

The copied format is:

```md
## Sentence
...

## Meaning
...

## Correction
...

## Notes
...

## Alternatives
...

#english #writing
```

Paste it into any Obsidian note.

## GitHub Pages

This repo is configured to deploy through GitHub Actions.

Expected public URL:

```text
https://limengke123.github.io/LinguaCheck/
```

GitHub repository setting required:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

The workflow is defined in:

```text
.github/workflows/deploy.yml
```

The Pages build sets:

```text
VITE_BASE_PATH=/LinguaCheck/
```

This makes Vite emit assets with the correct `/LinguaCheck/` base path.

## Scripts

```bash
npm run dev       # Start local dev server
npm run build     # Type-check and build production assets
npm run preview   # Preview production build locally
```
