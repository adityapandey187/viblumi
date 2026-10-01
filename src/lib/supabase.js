/**
 * supabase.js - the connection to Supabase (accounts + database).
 *
 * The URL and the public "anon" key are safe to ship in the browser: the
 * database rules (row level security, see supabase/schema.sql) make sure each
 * user can only touch their own rows. They are set as VITE_ variables at
 * build time. If they are missing, `supabase` is null and Viblumi runs in
 * "guest mode" (no accounts, nothing saved) so the site never breaks.
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const accountsEnabled = Boolean(supabase);
