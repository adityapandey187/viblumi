import { useState } from "react";

const SUGGESTIONS = {
  website: [
    "A landing page for my chai startup",
    "A personal portfolio with my projects",
    "A quiz game about space",
    "A restaurant page with menu and booking form",
  ],
  app: [
    "A todo app where I can add, finish and delete tasks",
    "An expense tracker with totals by category",
    "A notes app with search",
    "A habit tracker with daily check-ins",
  ],
};

/**
 * The landing view: one big prompt box, Lovable-style.
 */
export default function Home({ onSubmit, projects, onOpen, onDelete, accountsEnabled, user, onSignIn, onSignOut }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("website");

  function submit(value) {
    const idea = (value ?? text).trim();
    if (idea) onSubmit(idea, mode);
  }

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="brand">
          <span className="brand-mark">V</span>
          <span className="brand-name">Viblumi</span>
        </div>
        <div className="nav-right">
          <span className="nav-tag">Phase 2</span>
          {accountsEnabled &&
            (user ? (
              <>
                <span className="muted nav-email">{user.email}</span>
                <button className="btn-ghost" onClick={onSignOut}>Log out</button>
              </>
            ) : (
              <button className="btn-ghost" onClick={onSignIn}>Sign up / Log in</button>
            ))}
        </div>
      </nav>

      <main className="hero">
        <h1>
          Describe it. <span className="gradient-text">Watch it get built.</span>
        </h1>
        <p className="hero-sub">
          Type the website or app you want - Viblumi's AI writes the code and
          shows you a live preview in seconds.
        </p>

        <div className="mode-toggle" role="tablist">
          <button className={mode === "website" ? "mode active" : "mode"} onClick={() => setMode("website")}>
            Website
            <small>Static page</small>
          </button>
          <button className={mode === "app" ? "mode active" : "mode"} onClick={() => setMode("app")}>
            Full-stack app
            <small>With a real database</small>
          </button>
        </div>

        <div className="prompt-card">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              mode === "app"
                ? "A todo app where I can add tasks, mark them done and delete them..."
                : "A modern landing page for a fitness coach with pricing and a signup form..."
            }
            rows={3}
            autoFocus
          />
          <div className="prompt-actions">
            <span className="hint">Enter to build - Shift+Enter for a new line</span>
            <button className="btn-primary" onClick={() => submit()} disabled={!text.trim()}>
              Build it
            </button>
          </div>
        </div>

        <div className="chips">
          {SUGGESTIONS[mode].map((s) => (
            <button key={s} className="chip" onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>

        {user && projects.length > 0 && (
          <section className="projects">
            <h2>Your projects</h2>
            <div className="project-grid">
              {projects.map((p) => (
                <div key={p.id} className="project-card" onClick={() => onOpen(p.id)}>
                  <div className="project-name">{p.name}</div>
                  <div className="muted">
                    {p.mode === "app" ? "Full-stack app" : "Website"} - {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                  <button
                    className="project-delete"
                    title="Delete project"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${p.name}"? This cannot be undone.`)) onDelete(p.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {accountsEnabled && !user && (
          <p className="muted guest-note">
            <button className="link-button" onClick={onSignIn}>Sign up</button> to save your projects and keep editing later.
          </p>
        )}
      </main>

      <footer className="home-footer">Deploy with one click comes next.</footer>
    </div>
  );
}
