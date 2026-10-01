"""
generate.py - POST /api/generate

The one endpoint that matters: takes the conversation + the user's new
instruction, streams the model's reply back as Server-Sent Events.

Request body (JSON):
    {
      "conversation": [{"role": "user"|"assistant", "content": "..."}],
      "instruction":  "a landing page for a coffee shop",
      "current_code": "<!doctype html>...",  # optional, only when editing
      "mode": "website" | "app"              # app = full-stack with a database
    }

Streamed events (one JSON object per SSE "data:" line):
    {"type": "status", "text": "..."}    progress messages for the UI
    {"type": "delta",  "text": "..."}    raw model output, piece by piece
    {"type": "done",   "code": "...", "summary": "..."}
    {"type": "error",  "message": "..."}
"""

import os
import sys

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from typing import List, Optional

from pydantic import BaseModel

# Make the project root importable both locally and on Vercel,
# so `api._lib` resolves no matter where the function runs.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api._lib import llm
from api._lib.engine import build_export_sql, build_messages, extract_code, find_collections
from api._lib.http import friendly_error, sse

app = FastAPI()


class GenerateRequest(BaseModel):
    conversation: List[dict] = []
    instruction: str
    current_code: Optional[str] = None
    mode: str = "website"  # "website" or "app" (full-stack)


def event_stream(body: GenerateRequest):
    """A generator: each `yield` sends one event to the browser immediately."""
    if not llm.is_configured():
        yield sse({"type": "error", "message":
                   "No model API key configured yet. Set VIBLUMI_LLM_API_KEY "
                   "in your environment variables and try again."})
        return

    yield sse({"type": "status", "text": "Contacting the AI model..."})

    messages = build_messages(body.conversation, body.instruction, body.current_code, body.mode)

    # 1. Stream the model's reply through to the browser as it arrives.
    pieces = []
    announced_writing = False
    try:
        for piece in llm.stream_completion(messages):
            if not announced_writing:
                yield sse({"type": "status", "text": "Writing your website..."})
                announced_writing = True
            pieces.append(piece)
            yield sse({"type": "delta", "text": piece})
    except Exception as exc:  # model/network/config problems land here
        yield sse({"type": "error", "message": friendly_error(exc)})
        return

    # 2. Split the reply into the friendly note and the html file.
    code, note = extract_code("".join(pieces))
    if code is None:
        yield sse({"type": "error", "message":
                   "The model replied but did not produce a usable website file. "
                   "Try rephrasing your idea."})
        return

    collections = find_collections(code) if body.mode == "app" else []
    yield sse({
        "type": "done",
        "code": code,
        "summary": note or "Done! Your site is in the preview.",
        "collections": collections,
        "export_sql": build_export_sql(collections),
    })


@app.post("/api/generate")
def generate(body: GenerateRequest):
    return StreamingResponse(
        event_stream(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # ask proxies not to buffer the stream
        },
    )
