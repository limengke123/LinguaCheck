# LinguaCheck

LinguaCheck is a pure frontend AI English assistant for reading, writing checks, translation, polishing, naturalness review, and Obsidian Markdown export.

It runs entirely in the browser. There is no backend, database, login system, or server-side API proxy.

## Features

- Single text input for English, Chinese, or mixed text
- Prompt actions: Explain, EN -> ZH, ZH -> EN, Polish, Naturalness Check
- Multiple OpenAI-compatible providers
- Add, edit, delete, select, and test providers in the provider panel
- Default provider setting
- Result cards rendered as Markdown
- New result cards open automatically; older result cards collapse automatically
- Result cards support hover-to-copy output and re-run
- API keys, base URLs, models, and provider settings stored in `localStorage`

## Requirements

- Node.js LTS is recommended
- npm
- One or more OpenAI-compatible APIs, such as OpenAI, DeepSeek-compatible gateways, or local oMLX

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

If port `5173` is already in use:

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

## Provider Configuration

Click the small settings icon in the input footer to manage OpenAI-compatible providers.

Each provider has:

- Name
- Base URL
- Model
- API Key
- Test button

Remote providers usually require an API key. Local providers such as oMLX can leave the API key empty.

## oMLX Example

Use the OpenAI-compatible provider path, not an Ollama path.

Recommended settings:

```text
Name: oMLX
API Key: leave empty
Base URL: http://localhost:8099/v1
Model: Qwen3.6-35B-A3B-4bit
```

This also works because LinguaCheck retries with `/v1/chat/completions` after a root `404`:

```text
Base URL: http://localhost:8099
```

The request path is:

```text
/v1/chat/completions
```

## Browser Notes

Because this app is pure frontend, requests are sent directly from the browser.

- Providers must allow browser CORS requests.
- API keys are stored in browser `localStorage`, as required by the MVP.
- GitHub Pages is HTTPS. Browser security may block calls from the deployed page to plain HTTP local endpoints such as `http://localhost:8099`; for local models, local development mode is usually the most reliable path.

## Markdown Copy

Hover over a result body and click the copy icon to copy that result's Markdown.

The copied content is the raw Markdown returned by the model, so it can be pasted into Obsidian or any Markdown editor.

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
