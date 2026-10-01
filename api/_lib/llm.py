"""
llm.py - the only file that talks to the AI model.

Viblumi is model-agnostic: the model is chosen entirely through
environment variables, so you can swap providers without touching code.

    VIBLUMI_LLM_BASE_URL   any OpenAI-compatible API base URL
                           (default: Groq - free tier, very fast)
    VIBLUMI_LLM_API_KEY    the API key / token for that provider
    VIBLUMI_LLM_MODEL      the model id to use
                           (default: llama-3.3-70b-versatile)
    VIBLUMI_LLM_MAX_TOKENS max tokens the model may write per reply

Examples of other providers you could switch to later:
    OpenRouter:  base https://openrouter.ai/api/v1   model meta-llama/llama-3.3-70b-instruct
    OpenAI:      base https://api.openai.com/v1      model gpt-4o
    Azure AI:    base <your Azure AI Foundry endpoint>
"""

import os

from openai import OpenAI

# Read the configuration once when the module loads.
BASE_URL = os.environ.get("VIBLUMI_LLM_BASE_URL", "https://api.groq.com/openai/v1")
API_KEY = os.environ.get("VIBLUMI_LLM_API_KEY", "")
MODEL = os.environ.get("VIBLUMI_LLM_MODEL", "llama-3.3-70b-versatile")
MAX_TOKENS = int(os.environ.get("VIBLUMI_LLM_MAX_TOKENS", "12000"))


def is_configured() -> bool:
    """True when an API key is present. The health endpoint uses this."""
    return bool(API_KEY)


def stream_completion(messages):
    """
    Ask the model for a reply and yield the text piece by piece (streaming).

    `messages` is a list of {"role": ..., "content": ...} dicts in the
    standard OpenAI chat format. Streaming lets the website show progress
    while the model is still writing code, instead of a long silent wait.
    """
    client = OpenAI(
        base_url=BASE_URL,
        api_key=API_KEY,
        timeout=300,  # generous: code generation can take a while
    )
    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,          # <- this is what makes it stream
        max_tokens=MAX_TOKENS,
        temperature=0.7,      # a little creativity, still reliable
    )
    for chunk in stream:
        if not chunk.choices:
            continue
        piece = chunk.choices[0].delta.content
        if piece:
            yield piece
