"""
dev/mock_llm.py - a fake OpenAI-compatible model server for LOCAL TESTING ONLY.

It implements POST /chat/completions with streaming, and replies with a
canned website that mentions the user's prompt. This lets us test the full
Viblumi pipeline (backend -> SSE -> frontend) without a real API key.

Run:  uvicorn dev.mock_llm:app --port 8099
Then: VIBLUMI_LLM_BASE_URL=http://localhost:8099 VIBLUMI_LLM_API_KEY=test \
      uvicorn api.generate:app --port 8000
"""

import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()

SITE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mock Site</title>
<style>
  body { margin:0; font-family:system-ui; background:#0f172a; color:#e2e8f0;
         display:grid; place-items:center; min-height:100vh; text-align:center; }
  h1 { background:linear-gradient(135deg,#8b5cf6,#22d3ee);
       -webkit-background-clip:text; background-clip:text; color:transparent;
       font-size:3rem; margin:0 0 12px; }
  p { color:#94a3b8; max-width:420px; }
  button { background:linear-gradient(135deg,#8b5cf6,#22d3ee); border:none;
           color:white; padding:12px 28px; border-radius:10px; font-size:1rem;
           cursor:pointer; margin-top:18px; }
</style>
</head>
<body>
  <main>
    <h1>__TITLE__</h1>
    <p>This is a mock-generated page about: __PROMPT__</p>
    <button onclick="this.textContent='It works!'">Click me</button>
  </main>
</body>
</html>"""


@app.post("/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    # The last user message holds the instruction (and current code when editing).
    last_user = next(
        (m["content"] for m in reversed(body.get("messages", [])) if m.get("role") == "user"),
        "something",
    )
    editing = "current version of the website file" in last_user
    prompt_hint = last_user[:120].replace("<", "").replace(">", "")
    title = "Updated Site" if editing else "Mock Site"

    site = SITE_TEMPLATE.replace("__TITLE__", title).replace("__PROMPT__", prompt_hint)
    note = "Here is your updated website!" if editing else "Here is a fresh website based on your idea!"
    reply = f"{note}\n\n```html\n{site}\n```"

    async def stream():
        # Chop the reply into small pieces like a real streaming model.
        for i in range(0, len(reply), 48):
            piece = reply[i : i + 48]
            chunk = {
                "choices": [{"delta": {"content": piece}, "index": 0}],
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            await asyncio.sleep(0.005)
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
