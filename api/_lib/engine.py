"""
engine.py - the brains of the request:

1. build_messages() turns (conversation + current code + new instruction)
   into the message list we send to the model.
2. extract_code() pulls the html file out of the model's reply.
"""

import re

from .prompts import SYSTEM_PROMPT

# How many previous chat turns we resend to the model for context.
# More turns = better memory of the conversation, but costs more tokens.
MAX_HISTORY_TURNS = 8


def build_messages(conversation, instruction, current_code=None):
    """
    conversation: list of prior {"role": "user"|"assistant", "content": str}
                  (assistant messages are short notes, NOT code)
    instruction:  the user's new request, e.g. "make the header blue"
    current_code: the html file as it currently exists (None for the first build)
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Replay the recent conversation so follow-ups like "now darker" make sense.
    for msg in conversation[-MAX_HISTORY_TURNS:]:
        role = msg.get("role")
        if role in ("user", "assistant"):
            # Trim very long messages to keep the request small.
            messages.append({"role": role, "content": str(msg.get("content", ""))[:1000]})

    if current_code:
        # Editing an existing site: hand the model the file plus the change.
        messages.append({
            "role": "user",
            "content": (
                "Here is the current version of the website file:\n\n"
                f"```html\n{current_code}\n```\n\n"
                f"Apply this change and return the full updated file: {instruction}"
            ),
        })
    else:
        # First build: the instruction alone is the whole request.
        messages.append({"role": "user", "content": instruction})

    return messages


# Matches ```html ... ``` (also accepts ``` without a language tag).
_FENCE_RE = re.compile(r"```(?:html)?\s*\n(.*?)```", re.DOTALL)


def extract_code(reply_text):
    """
    Split the model's reply into (code, note).

    code: the html file, or None if we could not find one
    note: the friendly sentence(s) the model wrote before the code fence
    """
    match = _FENCE_RE.search(reply_text)
    if match:
        code = match.group(1).strip()
        note = reply_text[: match.start()].strip()
        return code, note

    # Fallback: no fence, but the reply looks like raw html.
    if "<html" in reply_text.lower() or "<!doctype" in reply_text.lower():
        start = re.search(r"<(?:!doctype|html)", reply_text, re.IGNORECASE).start()
        return reply_text[start:].strip(), ""

    return None, reply_text.strip()
