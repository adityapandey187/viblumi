/**
 * previewSdk.js - lets a generated app talk to a database from inside the
 * sandboxed preview iframe.
 *
 * The iframe is sandboxed (it cannot touch Viblumi or the network keys), so
 * it cannot call Supabase itself. Instead:
 *
 *   generated app --postMessage--> Viblumi (parent page) --> appData.js
 *                 <--postMessage-- answer
 *
 * 1. SDK_SCRIPT is injected into the generated page and defines window.viblumi.
 * 2. attachBridge() runs in the parent and answers those messages.
 */

// Runs INSIDE the iframe. Kept as plain ES5-ish text so it is easy to inject.
const SDK_SCRIPT = `<script>
(function () {
  var pending = {};
  var counter = 0;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.__viblumi !== "reply" || !pending[m.id]) return;
    var p = pending[m.id];
    delete pending[m.id];
    m.ok ? p.resolve(m.result) : p.reject(new Error(m.error || "Database error"));
  });
  function call(op, collection, id, data) {
    return new Promise(function (resolve, reject) {
      var callId = ++counter;
      pending[callId] = { resolve: resolve, reject: reject };
      parent.postMessage({ __viblumi: "call", id: callId, op: op, collection: collection, rowId: id, data: data }, "*");
      setTimeout(function () {
        if (pending[callId]) { delete pending[callId]; reject(new Error("Database timed out")); }
      }, 15000);
    });
  }
  window.viblumi = { db: {
    list: function (c) { return call("list", c); },
    insert: function (c, data) { return call("insert", c, null, data); },
    update: function (c, id, patch) { return call("update", c, id, patch); },
    remove: function (c, id) { return call("remove", c, id); }
  } };
})();
</script>`;

/** Put the SDK at the top of the generated page's <head>. */
export function withSdk(html) {
  if (!html) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + SDK_SCRIPT);
  return SDK_SCRIPT + html;
}

/**
 * Listen for database calls from ONE iframe. Returns a function that stops
 * listening. `getData()` returns the current appData object.
 */
export function attachBridge(iframe, getData) {
  async function onMessage(e) {
    // Only trust messages that come from our own preview iframe.
    if (!iframe || e.source !== iframe.contentWindow) return;
    const m = e.data;
    if (!m || m.__viblumi !== "call") return;
    const reply = { __viblumi: "reply", id: m.id };
    try {
      const db = getData();
      if (typeof m.collection !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(m.collection)) {
        throw new Error("Collection names must be lowercase letters, numbers and underscores");
      }
      if (m.op === "list") reply.result = await db.list(m.collection);
      else if (m.op === "insert") reply.result = await db.insert(m.collection, m.data || {});
      else if (m.op === "update") reply.result = await db.update(m.collection, m.rowId, m.data || {});
      else if (m.op === "remove") reply.result = await db.remove(m.collection, m.rowId);
      else throw new Error("Unknown operation");
      reply.ok = true;
    } catch (err) {
      reply.ok = false;
      reply.error = err.message;
    }
    // The sandboxed iframe has an opaque origin, so "*" is the only target.
    e.source.postMessage(reply, "*");
  }
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
