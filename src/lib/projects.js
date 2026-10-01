/**
 * projects.js - saving and loading projects (table `projects`).
 *
 * Every function talks straight to Supabase from the browser. Security is
 * enforced by the database: row level security only returns the signed-in
 * user's own rows, so there is no server code to write for this.
 */
import { supabase } from "./supabase.js";

const LIST_COLUMNS = "id,name,mode,updated_at";

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjects() {
  return check(
    await supabase.from("viblumi_projects").select(LIST_COLUMNS).order("updated_at", { ascending: false })
  );
}

export async function loadProject(id) {
  return check(await supabase.from("viblumi_projects").select("*").eq("id", id).single());
}

export async function createProject({ name, mode }) {
  return check(
    await supabase.from("viblumi_projects").insert({ name, mode }).select("*").single()
  );
}

/** Save the latest code + chat (and optionally a new name). */
export async function saveProject(id, fields) {
  return check(
    await supabase
      .from("viblumi_projects")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(LIST_COLUMNS)
      .single()
  );
}

export async function deleteProject(id) {
  check(await supabase.from("viblumi_projects").delete().eq("id", id));
}
