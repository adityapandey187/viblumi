"""
dev/server.py - local development backend on ONE port.

On Vercel, api/generate.py and api/health.py are deployed as separate
serverless functions. Locally it is easier to run both endpoints in a
single uvicorn process so the Vite proxy only needs one target:

    .venv/bin/uvicorn dev.server:app --port 8000

(with VIBLUMI_LLM_* env vars set - see .env.example)
"""

import os
import sys

from fastapi import FastAPI

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.generate import app as _generate_app
from api.health import app as _health_app

app = FastAPI(title="Viblumi local dev server")

# Reuse the exact same route definitions the Vercel functions serve.
for route in list(_generate_app.routes) + list(_health_app.routes):
    app.router.routes.append(route)
