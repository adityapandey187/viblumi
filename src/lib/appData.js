/**
 * appData.js - the database behind generated full-stack apps.
 *
 * A generated app calls viblumi.db.list/insert/update/remove("things", ...).
 * Those calls arrive here (via previewSdk.js). Rows are stored in the shared
 * table `app_rows` (project_id + collection + a JSON `data` column).
 *
 * Signed in  -> rows go to Supabase and survive refreshes and new devices.
 * Guest      -> rows go to this browser's localStorage (fine for trying it).
 */
import { supabase } from "./supabase.js";

// Flatten a stored row into what the generated app sees: {id, created_at, ...fields}
const toApp = (r) => ({ ...r.data, id: r.id, created_at: r.created_at });

function fail(error) {
  throw new Error(error.message || "Database error");
}

function groupRows(rows) {
  const out = {};
  for (const r of rows) (out[r.collection] ||= []).push(toApp(r));
  return out;
}

/** Returns an object with list/insert/update/remove for ONE project. */
export function createAppData(projectId) {
  return projectId && supabase ? cloudData(projectId) : localData(projectId || "draft");
}

function cloudData(projectId) {
  const rows = () => supabase.from("viblumi_app_rows");
  return {
    // Everything this project stored, grouped by collection (for the Database tab).
    async listAll() {
      const { data, error } = await rows()
        .select("id,collection,data,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) fail(error);
      return groupRows(data);
    },
    async list(collection) {
      const { data, error } = await rows()
        .select("id,data,created_at")
        .eq("project_id", projectId)
        .eq("collection", collection)
        .order("created_at", { ascending: true });
      if (error) fail(error);
      return data.map(toApp);
    },
    async insert(collection, values) {
      const { data, error } = await rows()
        .insert({ project_id: projectId, collection, data: values })
        .select("id,data,created_at")
        .single();
      if (error) fail(error);
      return toApp(data);
    },
    async update(collection, id, patch) {
      // Merge the patch into the existing JSON so partial updates work.
      const found = await rows().select("data").eq("id", id).eq("project_id", projectId).single();
      if (found.error) fail(found.error);
      const { data, error } = await rows()
        .update({ data: { ...found.data.data, ...patch } })
        .eq("id", id)
        .eq("project_id", projectId)
        .select("id,data,created_at")
        .single();
      if (error) fail(error);
      return toApp(data);
    },
    async remove(collection, id) {
      const { error } = await rows().delete().eq("id", id).eq("project_id", projectId);
      if (error) fail(error);
      return true;
    },
  };
}

function localData(projectId) {
  const key = `viblumi:data:${projectId}`;
  const read = () => JSON.parse(localStorage.getItem(key) || "{}");
  const write = (all) => localStorage.setItem(key, JSON.stringify(all));
  const uid = () => crypto.randomUUID();
  return {
    async listAll() {
      const all = read();
      return Object.fromEntries(Object.entries(all).map(([c, rs]) => [c, rs.map(toApp)]));
    },
    async list(collection) {
      return (read()[collection] || []).map(toApp);
    },
    async insert(collection, values) {
      const all = read();
      const row = { id: uid(), data: values, created_at: new Date().toISOString() };
      all[collection] = [...(all[collection] || []), row];
      write(all);
      return toApp(row);
    },
    async update(collection, id, patch) {
      const all = read();
      const row = (all[collection] || []).find((r) => r.id === id);
      if (!row) throw new Error("Row not found");
      row.data = { ...row.data, ...patch };
      write(all);
      return toApp(row);
    },
    async remove(collection, id) {
      const all = read();
      all[collection] = (all[collection] || []).filter((r) => r.id !== id);
      write(all);
      return true;
    },
  };
}
