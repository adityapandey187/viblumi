/**
 * api.js - talks to the Python backend.
 *
 * streamGenerate() POSTs to /api/generate and reads the reply as a
 * Server-Sent Events stream. Each event is handed to onEvent() as it
 * arrives, so the UI can show live progress while the AI writes code.
 */

export async function streamGenerate({ conversation, instruction, currentCode, onEvent }) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation,
      instruction,
      current_code: currentCode || null,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Engine replied with status ${response.status}`);
  }

  // Read the stream chunk by chunk. Events are separated by blank lines,
  // so we keep a buffer and split on "\n\n".
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let splitAt;
    while ((splitAt = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);

      const dataLine = rawEvent
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      try {
        onEvent(JSON.parse(dataLine.slice(6)));
      } catch {
        // Ignore a malformed event rather than killing the whole build.
      }
    }
  }
}

export async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
