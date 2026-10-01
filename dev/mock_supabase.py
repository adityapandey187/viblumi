"""
mock_supabase.py - a tiny fake Supabase for LOCAL TESTING ONLY.

It copies just enough of Supabase's Auth (GoTrue) and database (PostgREST)
HTTP API for Viblumi to run without internet or a real project:
  - sign up / log in / refresh / log out with email + password
  - tables `projects` and `app_rows`, with the same "you only see your own
    rows" rule that the real database enforces through row level security.

Run:  uvicorn dev.mock_supabase:app --port 54321
Then build the frontend with VITE_SUPABASE_URL=http://localhost:54321
"""
import base64, json, time, uuid

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["*"])

USERS = {}      # email -> {id, email, password}
REFRESH = {}    # refresh_token -> user id
TABLES = {"projects": [], "app_rows": []}


def b64(d: bytes) -> str:
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()


def make_session(user):
    now = int(time.time())
    payload = {"sub": user["id"], "email": user["email"], "role": "authenticated",
               "aud": "authenticated", "exp": now + 3600, "iat": now}
    token = ".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps(payload).encode()), "sig"])
    refresh = uuid.uuid4().hex
    REFRESH[refresh] = user["id"]
    return {
        "access_token": token, "token_type": "bearer", "expires_in": 3600,
        "expires_at": now + 3600, "refresh_token": refresh,
        "user": {"id": user["id"], "email": user["email"], "aud": "authenticated",
                 "role": "authenticated", "app_metadata": {}, "user_metadata": {},
                 "created_at": "2026-01-01T00:00:00Z"},
    }


def uid_from(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        part = auth[7:].split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))["sub"]
    except Exception:
        return None


def err(status, msg):
    return JSONResponse({"code": status, "error_code": "mock", "msg": msg, "message": msg}, status_code=status)


# ---------------- Auth ----------------
@app.post("/auth/v1/signup")
async def signup(request: Request):
    body = await request.json()
    email = body["email"].lower()
    if email in USERS:
        return err(422, "User already registered")
    if len(body["password"]) < 6:
        return err(422, "Password should be at least 6 characters.")
    USERS[email] = {"id": str(uuid.uuid4()), "email": email, "password": body["password"]}
    return make_session(USERS[email])


@app.post("/auth/v1/token")
async def token(request: Request, grant_type: str):
    body = await request.json()
    if grant_type == "password":
        user = USERS.get(body["email"].lower())
        if not user or user["password"] != body["password"]:
            return err(400, "Invalid login credentials")
        return make_session(user)
    uid = REFRESH.get(body.get("refresh_token"))
    user = next((u for u in USERS.values() if u["id"] == uid), None)
    return make_session(user) if user else err(400, "Invalid Refresh Token")


@app.get("/auth/v1/user")
async def get_user(request: Request):
    uid = uid_from(request)
    user = next((u for u in USERS.values() if u["id"] == uid), None)
    return make_session(user)["user"] if user else err(401, "invalid JWT")


@app.post("/auth/v1/logout")
async def logout():
    return Response(status_code=204)


# ---------------- Database (PostgREST style) ----------------
def visible(table, uid):
    """Row level security: only the owner's rows."""
    if table == "projects":
        return [r for r in TABLES["projects"] if r["user_id"] == uid]
    mine = {p["id"] for p in TABLES["projects"] if p["user_id"] == uid}
    return [r for r in TABLES["app_rows"] if r["project_id"] in mine]


def apply_filters(rows, params):
    for key, val in params.items():
        if key in ("select", "order", "limit", "columns"):
            continue
        op, _, arg = val.partition(".")
        if op == "eq":
            rows = [r for r in rows if str(r.get(key)) == arg]
    order = params.get("order")
    if order:
        col, _, direction = order.partition(".")
        rows = sorted(rows, key=lambda r: str(r.get(col)), reverse=direction == "desc")
    return rows


def respond(request, rows, status=200):
    single = "vnd.pgrst.object" in request.headers.get("accept", "")
    if single:
        if len(rows) != 1:
            return JSONResponse({"code": "PGRST116", "message": "JSON object requested, multiple (or no) rows returned"}, status_code=406)
        return JSONResponse(rows[0], status_code=status)
    return JSONResponse(rows, status_code=status)


@app.api_route("/rest/v1/{table}", methods=["GET", "POST", "PATCH", "DELETE"])
async def rest(table: str, request: Request):
    uid = uid_from(request)
    if uid is None:
        return err(401, "JWT required")
    if table not in TABLES:
        return err(404, "unknown table")
    params = dict(request.query_params)
    now = time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())
    prefers = request.headers.get("prefer", "")

    if request.method == "GET":
        return respond(request, apply_filters(visible(table, uid), params))

    if request.method == "POST":
        body = await request.json()
        items = body if isinstance(body, list) else [body]
        created = []
        for item in items:
            row = {"id": str(uuid.uuid4()), "created_at": now, **item}
            if table == "projects":
                row.setdefault("user_id", uid)
                row.setdefault("name", "Untitled project")
                row.setdefault("mode", "website")
                row.setdefault("code", "")
                row.setdefault("messages", [])
                row["updated_at"] = now
                if row["user_id"] != uid:
                    return err(403, "new row violates row-level security policy")
            else:
                if row.get("project_id") not in {p["id"] for p in visible("projects", uid)}:
                    return err(403, "new row violates row-level security policy")
                row.setdefault("data", {})
            TABLES[table].append(row)
            created.append(row)
        return respond(request, created, 201) if "return=representation" in prefers else Response(status_code=201)

    targets = apply_filters(visible(table, uid), params)
    if request.method == "PATCH":
        patch = await request.json()
        for r in targets:
            r.update(patch)
        return respond(request, targets) if "return=representation" in prefers else Response(status_code=204)

    ids = {r["id"] for r in targets}  # DELETE
    TABLES[table] = [r for r in TABLES[table] if r["id"] not in ids]
    if table == "projects":  # cascade like the real foreign key
        TABLES["app_rows"] = [r for r in TABLES["app_rows"] if r["project_id"] not in ids]
    return Response(status_code=204)
