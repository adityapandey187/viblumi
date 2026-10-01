import { useState } from "react";

const SUGGESTIONS = [
  "A landing page for my chai startup",
  "A personal portfolio with my projects",
  "A quiz game about space",
  "A habit tracker with dark mode",
];

/**
 * The landing view: one big prompt box, Lovable-style.
 */
export default function Home({ onSubmit }) {
  const [text, setText] = useState("");

  function submit(value) {
    const idea = (value ?? text).trim();
    if (idea) onSubmit(idea);
  }

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="brand">
          <span className="brand-mark">V</span>
          <span className="brand-name">Viblumi</span>
        </div>
        <span className="nav-tag">Phase 1</span>
      </nav>

      <main className="hero">
        <h1>
          Describe it. <span className="gradient-text">Watch it get built.</span>
        </h1>
        <p className="hero-sub">
          Type the website you want - Viblumi's AI writes the code and shows
          you a live preview in seconds.
        </p>

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
            placeholder="A modern landing page for a fitness coach with pricing and a signup form..."
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
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      </main>

      <footer className="home-footer">Websites only in Phase 1 - apps and deploy come next.</footer>
    </div>
  );
}
