import { useState } from "react";
import Home from "./components/Home.jsx";
import Builder from "./components/Builder.jsx";
import { streamGenerate } from "./api.js";

/**
 * App owns all state and the one important action: runGeneration().
 *
 * view      "home" (landing) or "builder" (chat + preview)
 * messages  the chat history: { role: "user"|"assistant", content, error? }
 * code      the current generated html file (null until the first build)
 * busy      true while the AI is generating
 * status    live progress text ("Contacting the AI model..." etc.)
 */
export default function App() {
  const [view, setView] = useState("home");
  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function runGeneration(instruction) {
    if (busy) return;
    setBusy(true);
    setStatus("Starting...");

    // Snapshot history/code BEFORE adding the new message - the backend
    // expects the prior conversation separately from the new instruction.
    const conversation = messages;
    const currentCode = code;

    setMessages((prev) => [...prev, { role: "user", content: instruction }]);

    const assistantMessage = { role: "assistant", content: "" };

    try {
      await streamGenerate({
        conversation,
        instruction,
        currentCode,
        onEvent: (event) => {
          if (event.type === "status") {
            setStatus(event.text);
          } else if (event.type === "done") {
            setCode(event.code);
            assistantMessage.content =
              event.summary || "Done! Your updated site is in the preview.";
          } else if (event.type === "error") {
            assistantMessage.content = event.message;
            assistantMessage.error = true;
          }
        },
      });
    } catch {
      assistantMessage.content =
        "Could not reach the Viblumi engine. If you are running locally, make sure the Python backend (uvicorn) is running on port 8000.";
      assistantMessage.error = true;
    }

    // If the stream ended with no done/error event at all, say something.
    if (!assistantMessage.content) {
      assistantMessage.content =
        "The engine stopped without finishing. Please try again.";
      assistantMessage.error = true;
    }

    setMessages((prev) => [...prev, assistantMessage]);
    setBusy(false);
    setStatus("");
  }

  function handleFirstPrompt(text) {
    setView("builder");
    runGeneration(text);
  }

  function handleNewProject() {
    setView("home");
    setMessages([]);
    setCode(null);
    setBusy(false);
    setStatus("");
  }

  if (view === "home") {
    return <Home onSubmit={handleFirstPrompt} />;
  }

  return (
    <Builder
      messages={messages}
      code={code}
      busy={busy}
      status={status}
      onSend={runGeneration}
      onNewProject={handleNewProject}
    />
  );
}
