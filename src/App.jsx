import { useEffect, useRef, useState } from "react";
import Home from "./components/Home.jsx";
import Builder from "./components/Builder.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { streamGenerate } from "./api.js";
import { supabase, accountsEnabled } from "./lib/supabase.js";
import * as store from "./lib/projects.js";

/**
 * App owns all state and the important actions.
 *
 * view        "home" (landing + your projects) or "builder" (chat + preview)
 * mode        "website" (static page) or "app" (full-stack with a database)
 * user        the signed-in Supabase user, or null (guest)
 * projectId   the saved project's id (null until it is saved)
 * messages    chat history: { role: "user"|"assistant", content, error? }
 * code        the current generated html file (null until the first build)
 */
export default function App() {
  const [view, setView] = useState("home");
  const [mode, setMode] = useState("website");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Untitled project");
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState(null);
  const [exportSql, setExportSql] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState(""); // "", "saving", "saved", "error"

  // The latest values, readable inside async code without stale closures.
  const live = useRef({});
  live.current = { projectId, user, messages, code, mode };

  // ---------- Accounts ----------
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // When a user signs in: refresh their project list, and if they had already
  // built something as a guest, save it to their account right away.
  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    refreshProjects();
    const { projectId: pid, code: c, messages: m, mode: md } = live.current;
    if (!pid && c) {
      store
        .createProject({ name: nameFrom(m), mode: md })
        .then((p) => {
          setProjectId(p.id);
          setProjectName(p.name);
          return store.saveProject(p.id, { code: c, messages: m });
        })
        .then(refreshProjects)
        .catch(() => setSaveState("error"));
    }
  }, [user?.id]);

  async function refreshProjects() {
    try {
      setProjects(await store.listProjects());
    } catch {
      /* the list is a nicety; ignore failures */
    }
  }

  function nameFrom(msgs) {
    const first = msgs.find((x) => x.role === "user")?.content || "Untitled project";
    return first.length > 40 ? first.slice(0, 40).trim() + "..." : first;
  }

  // ---------- Generating ----------
  async function runGeneration(instruction, modeOverride) {
    if (busy) return;
    const useMode = modeOverride || live.current.mode;
    setBusy(true);
    setStatus("Starting...");

    // Snapshot history/code BEFORE adding the new message - the backend
    // expects the prior conversation separately from the new instruction.
    const conversation = live.current.messages;
    const currentCode = live.current.code;
    const userMessage = { role: "user", content: instruction };
    setMessages((prev) => [...prev, userMessage]);

    // Signed in and brand-new project: create it first so generated apps
    // have a project id to store their data under.
    let pid = live.current.projectId;
    if (live.current.user && !pid) {
      try {
        const p = await store.createProject({ name: nameFrom([userMessage]), mode: useMode });
        pid = p.id;
        setProjectId(p.id);
        setProjectName(p.name);
        live.current.projectId = p.id;
      } catch {
        setSaveState("error");
      }
    }

    const assistantMessage = { role: "assistant", content: "" };
    let newCode = currentCode;

    try {
      await streamGenerate({
        conversation,
        instruction,
        currentCode,
        mode: useMode,
        onEvent: (event) => {
          if (event.type === "status") {
            setStatus(event.text);
          } else if (event.type === "done") {
            newCode = event.code;
            setCode(event.code);
            setExportSql(event.export_sql || "");
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
        "Could not reach the Viblumi engine. If you are running locally, make sure the Python backend is running on port 8000.";
      assistantMessage.error = true;
    }

    // If the stream ended with no done/error event at all, say something.
    if (!assistantMessage.content) {
      assistantMessage.content = "The engine stopped without finishing. Please try again.";
      assistantMessage.error = true;
    }

    const finalMessages = [...conversation, userMessage, assistantMessage];
    setMessages(finalMessages);
    setBusy(false);
    setStatus("");

    // Save to the account (only when something was actually built).
    if (pid && live.current.user && newCode && !assistantMessage.error) {
      setSaveState("saving");
      try {
        await store.saveProject(pid, { code: newCode, messages: finalMessages, mode: useMode });
        setSaveState("saved");
        refreshProjects();
      } catch {
        setSaveState("error");
      }
    }
  }

  function handleFirstPrompt(text, chosenMode) {
    setMode(chosenMode);
    setView("builder");
    runGeneration(text, chosenMode);
  }

  // ---------- Projects ----------
  async function openProject(id) {
    try {
      const p = await store.loadProject(id);
      setProjectId(p.id);
      setProjectName(p.name);
      setMode(p.mode);
      setMessages(p.messages || []);
      setCode(p.code || null);
      setExportSql("");
      setSaveState("saved");
      setView("builder");
    } catch {
      alert("Could not open that project. Please try again.");
    }
  }

  async function renameProject(name) {
    const clean = name.trim() || "Untitled project";
    setProjectName(clean);
    if (projectId && user) {
      try {
        await store.saveProject(projectId, { name: clean });
        refreshProjects();
      } catch {
        setSaveState("error");
      }
    }
  }

  async function removeProject(id) {
    try {
      await store.deleteProject(id);
      refreshProjects();
    } catch {
      alert("Could not delete that project.");
    }
  }

  function handleNewProject() {
    setView("home");
    setMessages([]);
    setCode(null);
    setProjectId(null);
    setProjectName("Untitled project");
    setExportSql("");
    setBusy(false);
    setStatus("");
    setSaveState("");
    refreshProjects();
  }

  async function signOut() {
    await supabase.auth.signOut();
    handleNewProject();
  }

  const authProps = {
    accountsEnabled,
    user,
    onSignIn: () => setAuthOpen(true),
    onSignOut: signOut,
  };

  return (
    <>
      {view === "home" ? (
        <Home
          onSubmit={handleFirstPrompt}
          projects={projects}
          onOpen={openProject}
          onDelete={removeProject}
          {...authProps}
        />
      ) : (
        <Builder
          messages={messages}
          code={code}
          mode={mode}
          projectId={projectId}
          projectName={projectName}
          exportSql={exportSql}
          saveState={saveState}
          busy={busy}
          status={status}
          onSend={runGeneration}
          onRename={renameProject}
          onNewProject={handleNewProject}
          {...authProps}
        />
      )}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onDone={() => setAuthOpen(false)} />}
    </>
  );
}
