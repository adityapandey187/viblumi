# Viblumi

Describe a website in plain language - Viblumi's AI writes the code and shows
you a live preview, instantly. Then keep chatting to change anything.

**Phase 1 scope:** websites only (single self-contained html files), live
sandboxed preview, follow-up edits via chat, view/copy/download the code.
Full-stack apps and one-click deploy are Phase 2 and 3.

## How it works

```
browser                         Python backend (FastAPI)
+---------------+   POST /api/generate   +----------------------+   streaming   +------------------+
|  React (Vite) |  --------------------> |  engine -> llm.py    | ------------> | any OpenAI-compat|
|  chat + iframe|  <==================== |  (Server-Sent Events)| <------------ | API (default:    |
|  preview      |   status/delta/done    |                      |   tokens      | GitHub Models)   |
+---------------+                        +----------------------+               +------------------+
```

- The model returns one complete, self-contained `index.html` (inline CSS/JS).
- The preview is an `<iframe sandbox="allow-scripts">`: generated JavaScript
  runs, but it cannot touch Viblumi's own page, cookies or storage.
- The AI provider is swapped with 3 env vars - no code changes:

| Env var | Meaning | Default |
| --- | --- | --- |
| `VIBLUMI_LLM_BASE_URL` | OpenAI-compatible API base | `https://api.groq.com/openai/v1` (Groq free tier) |
| `VIBLUMI_LLM_API_KEY` | API key/token (secret!) | - |
| `VIBLUMI_LLM_MODEL` | Model id | `llama-3.3-70b-versatile` |
| `VIBLUMI_LLM_MAX_TOKENS` | Max reply length | `12000` |

## Local development

Requirements: Node 18+ and Python 3.10+.

```bash
# 1. Frontend deps
npm install

# 2. Python deps
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 3. Set your model key (Groq: create a free account at
#    https://console.groq.com, then a key at /keys)
cp .env.example .env   # then edit .env

# 4. Terminal 1 - backend on :8000
set -a; . ./.env; set +a
.venv/bin/uvicorn dev.server:app --port 8000

# 5. Terminal 2 - frontend on :5173 (proxies /api to :8000)
npm run dev
```

Open http://localhost:5173

### Try it without an API key

A fake model server is included for testing the pipeline:

```bash
.venv/bin/uvicorn dev.mock_llm:app --port 8099
VIBLUMI_LLM_BASE_URL=http://localhost:8099 VIBLUMI_LLM_API_KEY=test \
  .venv/bin/uvicorn dev.server:app --port 8000
npm run dev
```

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo.
2. In Vercel: Add New -> Project -> import the repo. Vercel detects Vite
   automatically (`vercel.json` pins the build command and function limits).
3. Add the env vars from the table above in Project Settings -> Environment
   Variables (`VIBLUMI_LLM_API_KEY` = your Groq API key - paste it there,
   never commit it).
4. Deploy. The `api/*.py` files become Python serverless functions; the
   frontend is served as a static Vite build.

Note: Vercel's free Hobby plan allows functions to run up to 300s;
maxDuration is set to 120s for generation, which Groq's fast models finish
well within. The system prompt also keeps generated sites compact so they
generate quickly; very large requests can be split into follow-up edits.
