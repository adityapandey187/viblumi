import { useEffect, useRef, useState } from "react";

/**
 * The builder view: chat on the left, live preview / code on the right.
 */
export default function Builder({ messages, code, busy, status, onSend, onNewProject }) {
  const [tab, setTab] = useState("preview");

  // Jump to the preview automatically whenever new code lands.
  const lastCodeRef = useRef(code);
  useEffect(() => {
    if (code && code !== lastCodeRef.current) setTab("preview");
    lastCodeRef.current = code;
  }, [code]);

  return (
    <div className="builder">
      <header className="builder-header">
        <button className="brand as-button" onClick={onNewProject} title="Start a new project">
          <span className="brand-mark">V</span>
          <span className="brand-name">Viblumi</span>
        </button>
        <div className="tabs">
          <button
            className={tab === "preview" ? "tab active" : "tab"}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
          <button
            className={tab === "code" ? "tab active" : "tab"}
            onClick={() => setTab("code")}
          >
            Code
          </button>
        </div>
      </header>

      <div className="builder-body">
        <ChatPanel messages={messages} busy={busy} status={status} onSend={onSend} />
        <section className="preview-panel">
          {tab === "preview" ? (
            <Preview code={code} busy={busy} status={status} />
          ) : (
            <CodeView code={code} />
          )}
        </section>
      </div>
    </div>
  );
}

function ChatPanel({ messages, busy, status, onSend }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // Keep the chat scrolled to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function send() {
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    onSend(value);
  }

  return (
    <aside className="chat-panel">
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="msg assistant working">
            <span className="spinner" />
            <span>{status || "Working..."}</span>
          </div>
        )}
      </div>
      <div className="chat-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={busy ? "Viblumi is building..." : "Ask for a change: 'make the header purple'..."}
          rows={2}
          disabled={busy}
        />
        <button className="btn-primary send-btn" onClick={send} disabled={busy || !text.trim()}>
          Send
        </button>
      </div>
    </aside>
  );
}

function Preview({ code, busy, status }) {
  if (!code) {
    return (
      <div className="preview-empty">
        {busy ? (
          <>
            <span className="spinner large" />
            <p>{status || "Building your website..."}</p>
            <p className="muted">The live preview will appear here.</p>
          </>
        ) : (
          <p className="muted">Your website preview will appear here.</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="preview-toolbar">
        <span className="dot green" /> <span className="dot yellow" /> <span className="dot red" />
        <span className="toolbar-label">Live preview</span>
        <button
          className="btn-ghost"
          onClick={() => {
            const blob = new Blob([code], { type: "text/html" });
            window.open(URL.createObjectURL(blob), "_blank");
          }}
        >
          Open in new tab
        </button>
      </div>
      {/* sandbox="allow-scripts" lets the generated site's JS run but keeps it
          isolated from Viblumi itself (no access to our page, cookies or storage). */}
      <iframe
        className="preview-frame"
        title="Website preview"
        sandbox="allow-scripts"
        srcDoc={code}
      />
      {busy && (
        <div className="preview-overlay">
          <span className="spinner large" />
          <p>{status || "Updating..."}</p>
        </div>
      )}
    </>
  );
}

function CodeView({ code }) {
  const [copied, setCopied] = useState(false);

  if (!code) {
    return (
      <div className="preview-empty">
        <p className="muted">No code yet - build something first.</p>
      </div>
    );
  }

  return (
    <div className="code-view">
      <div className="preview-toolbar">
        <span className="toolbar-label">index.html</span>
        <div className="toolbar-buttons">
          <button
            className="btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              const blob = new Blob([code], { type: "text/html" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "index.html";
              a.click();
            }}
          >
            Download
          </button>
        </div>
      </div>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}
