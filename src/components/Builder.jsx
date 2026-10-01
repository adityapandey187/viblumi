import { useEffect, useMemo, useRef, useState } from "react";
import { createAppData } from "../lib/appData.js";
import { attachBridge, withSdk } from "../lib/previewSdk.js";

/**
 * The builder view: chat on the left, live preview / code on the right.
 */
export default function Builder({
  messages, code, mode, projectId, projectName, exportSql, saveState, busy, status,
  onSend, onRename, onNewProject, accountsEnabled, user, onSignIn, onSignOut,
}) {
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
        <input
          className="project-title"
          key={projectName}
          defaultValue={projectName}
          onBlur={(e) => e.target.value !== projectName && onRename(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          aria-label="Project name"
        />
        <span className="mode-badge">{mode === "app" ? "Full-stack app" : "Website"}</span>
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
          {mode === "app" && (
            <button
              className={tab === "database" ? "tab active" : "tab"}
              onClick={() => setTab("database")}
            >
              Database
            </button>
          )}
        </div>
        <div className="header-right">
          {accountsEnabled && !user && (
            <button className="btn-ghost" onClick={onSignIn}>Sign in to save</button>
          )}
          {user && (
            <>
              <span className="save-state">
                {saveState === "saving" && "Saving..."}
                {saveState === "saved" && "Saved"}
                {saveState === "error" && "Not saved - retry by sending a message"}
              </span>
              <button className="btn-ghost" onClick={onSignOut}>Log out</button>
            </>
          )}
        </div>
      </header>

      <div className="builder-body">
        <ChatPanel messages={messages} busy={busy} status={status} onSend={onSend} />
        <section className="preview-panel">
          {tab === "preview" && (
            <Preview code={code} mode={mode} projectId={projectId} busy={busy} status={status} />
          )}
          {tab === "code" && <CodeView code={code} exportSql={exportSql} mode={mode} />}
          {tab === "database" && <DatabaseView projectId={projectId} exportSql={exportSql} user={user} />}
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

function Preview({ code, mode, projectId, busy, status }) {
  const frameRef = useRef(null);
  // One data object per project (cloud when signed in, localStorage as guest).
  const data = useMemo(() => createAppData(projectId), [projectId]);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Let a full-stack app talk to its database through the bridge.
  useEffect(() => {
    if (mode !== "app") return undefined;
    return attachBridge(frameRef.current, () => dataRef.current);
  }, [mode, code]);

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
      {/* sandbox="allow-scripts allow-forms" lets the generated site's JS run but keeps it
          isolated from Viblumi itself (no access to our page, cookies or storage). */}
      <iframe
        className="preview-frame"
        title="Website preview"
        sandbox="allow-scripts allow-forms"
        ref={frameRef}
        srcDoc={mode === "app" ? withSdk(code) : code}
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

function CodeView({ code, mode, exportSql }) {
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
      {mode === "app" && exportSql && (
        <>
          <div className="preview-toolbar">
            <span className="toolbar-label">schema.sql (only needed to host this app on your own Supabase)</span>
          </div>
          <pre className="code-block small">
            <code>{exportSql}</code>
          </pre>
        </>
      )}
    </div>
  );
}

/** Shows the data the generated app has stored so far. */
function DatabaseView({ projectId, user }) {
  const [tables, setTables] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setTables(await createAppData(projectId).listAll());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [projectId]);

  return (
    <div className="code-view database-view">
      <div className="preview-toolbar">
        <span className="toolbar-label">
          {user ? "Stored in your Viblumi database (Supabase)" : "Stored in this browser only - sign in to keep it"}
        </span>
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {tables && Object.keys(tables).length === 0 && (
        <p className="muted pad">Nothing stored yet. Use your app in the Preview tab, then press Refresh.</p>
      )}
      {tables &&
        Object.entries(tables).map(([name, rows]) => (
          <div key={name} className="db-table">
            <h3>{name} <span className="muted">({rows.length} rows)</span></h3>
            <pre className="code-block small"><code>{JSON.stringify(rows, null, 2)}</code></pre>
          </div>
        ))}
    </div>
  );
}
