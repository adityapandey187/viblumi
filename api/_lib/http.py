"""
http.py - small helpers shared by the API endpoints:

- Server-Sent Events (SSE): the format we stream replies in.
  Each event is one line starting with "data: " followed by JSON,
  then a blank line. Browsers and fetch() readers can consume this easily.
"""

import json


def sse(payload: dict) -> str:
    """Encode one event as a Server-Sent Events message."""
    return f"data: {json.dumps(payload)}\n\n"


def friendly_error(exc: Exception) -> str:
    """Turn a raw exception into a message that helps a beginner fix it."""
    text = str(exc)
    low = text.lower()
    if "401" in text or "unauthorized" in low or "authentication" in low:
        return ("The model API key was rejected. Check that VIBLUMI_LLM_API_KEY "
                "is set correctly in your environment variables.")
    if "429" in text or "rate limit" in low:
        return ("The model's free usage limit was reached. Wait a little and try "
                "again, or switch to another model/provider in the env vars.")
    if "404" in text:
        return ("The model id was not found. Check VIBLUMI_LLM_MODEL and that "
                "your provider actually hosts that model.")
    if "timeout" in low or "timed out" in low:
        return "The model took too long to answer. Try again - smaller sites generate faster."
    return f"Something went wrong while talking to the model: {text[:300]}"
