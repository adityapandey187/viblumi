import { useState } from "react";
import { supabase } from "../lib/supabase.js";

/**
 * Sign up / log in with email + password (Supabase Auth).
 * "Confirm email" is turned off in the Supabase project, so a new account
 * is signed in immediately.
 */
export default function AuthModal({ onClose, onDone }) {
  const [signUp, setSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const creds = { email: email.trim(), password };
      const { data, error: err } = signUp
        ? await supabase.auth.signUp(creds)
        : await supabase.auth.signInWithPassword(creds);
      if (err) throw err;
      if (signUp && !data.session) {
        setNotice("Account created. Check your email to confirm it, then log in.");
        setSignUp(false);
      } else {
        onDone();
      }
    } catch (err) {
      setError(friendly(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{signUp ? "Create your account" : "Welcome back"}</h2>
        <p className="muted">
          {signUp
            ? "Save your projects and come back to keep editing."
            : "Log in to open your saved projects."}
        </p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            placeholder="At least 6 characters"
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        {notice && <div className="form-notice">{notice}</div>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Please wait..." : signUp ? "Sign up" : "Log in"}
        </button>
        <button type="button" className="link-button" onClick={() => setSignUp(!signUp)}>
          {signUp ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}

// Turn Supabase's technical messages into plain language.
function friendly(message) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("already registered")) return "That email already has an account. Try logging in.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("password")) return "Password must be at least 6 characters.";
  return message;
}
