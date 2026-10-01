"""
health.py - GET /api/health

A quick check that the Python backend is alive and whether a model API key
is configured. The frontend pings this on load and warns early if the key
is missing.
"""

import os
import sys

from fastapi import FastAPI

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api._lib import llm

app = FastAPI()


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "model": llm.MODEL,
        "provider": llm.BASE_URL,
        "api_key_configured": llm.is_configured(),
    }
