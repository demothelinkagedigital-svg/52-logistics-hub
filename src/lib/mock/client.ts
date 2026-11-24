/* -------------------------------------------------------------------------- */
/*  Demo data client                                                           */
/*                                                                            */
/*  A tiny stand-in for the database client: the same chainable query shape    */
/*  the app already uses, backed by the in-browser demo dataset.               */
/* -------------------------------------------------------------------------- */

import { getDb, persist, table, uid, type Row } from "./db";
import { DEMO_USERS } from "./db";

type Result<T> = { data: T; error: { message: string } | null; count?: number | null };

type Filter = { op: string; column: string; value: any };

const AUTH_KEY = "52logistics-demo-user";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDemoUserId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(AUTH_KEY);
}

export function setDemoUserId(id: string | null) {
  if (!isBrowser()) return;
  if (id) window.localStorage.setItem(AUTH_KEY, id);
  else window.localStorage.removeItem(AUTH_KEY);
}

export function getDemoUser() {
  const id = getDemoUserId();
  if (!id) return null;
  const profile = table("profiles").find((p) => p["id"] === id);
  const seedUser = DEMO_USERS.find((u) => u.id === id);
  if (!profile && !seedUser) return null;
  return {
    id,
    email: (profile?.["email"] as string) ?? seedUser?.email ?? "demo@52logistics.demo",
    user_metadata: { full_name: (profile?.["full_name"] as string) ?? seedUser?.full_name ?? "Demo user" },
  };
}

export function demoRoles(userId: string | null): string[] {
  if (!userId) return [];
  return table("user_roles")
    .filter((r) => r["user_id"] === userId)
    .map((r) => String(r["role"]));
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((f) => {
    const v = row[f.column];
    switch (f.op) {
      case "eq":
        return v === f.value;
      case "neq":
        return v !== f.value;
      case "in":
        return Array.isArray(f.value) && f.value.includes(v);
      case "is":
        return f.value === null ? v === null || v === undefined : v === f.value;
      case "gt":
        return v > f.value;
      case "gte":
        return v >= f.value;
      case "lt":
        return v < f.value;
      case "lte":
        return v <= f.value;
      case "ilike":
        return String(v ?? "")
          .toLowerCase()
          .includes(String(f.value).replace(/%/g, "").toLowerCase());
      default:
        return true;
    }
  });
}

function compare(a: any, b: any, ascending: boolean, nullsFirst: boolean) {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an && bn) return 0;
  if (an) return nullsFirst ? -1 : 1;
  if (bn) return nullsFirst ? 1 : -1;
  if (a === b) return 0;
  return (a < b ? -1 : 1) * (ascending ? 1 : -1);
}

class QueryBuilder implements PromiseLike<Result<any[]>> {
  private tableName: string;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst: boolean }> = [];
  private limitValue: number | null = null;
  private singleMode: "one" | "maybe" | null = null;
  private headOnly = false;
  private wantCount = false;
  private conflict: string[] = [];
  private returnRows = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.mode === "select") this.mode = "select";
    this.returnRows = true;
    if (options?.count) this.wantCount = true;
    if (options?.head) this.headOnly = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }
  update(values: Row) {
    this.mode = "update";
    this.payload = [values];
    return this;
  }
  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.conflict = options?.onConflict ? options.onConflict.split(",").map((c) => c.trim()) : ["id"];
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(column: string, value: any) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }
  neq(column: string, value: any) {
    this.filters.push({ op: "neq", column, value });
    return this;
  }
  in(column: string, value: any[]) {
    this.filters.push({ op: "in", column, value });
    return this;
  }
  is(column: string, value: any) {
    this.filters.push({ op: "is", column, value });
    return this;
  }
  gt(column: string, value: any) {
    this.filters.push({ op: "gt", column, value });
    return this;
  }
  gte(column: string, value: any) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }
  lt(column: string, value: any) {
    this.filters.push({ op: "lt", column, value });
    return this;
  }
  lte(column: string, value: any) {
    this.filters.push({ op: "lte", column, value });
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push({ op: "ilike", column, value });
    return this;
  }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst === true,
    });
    return this;
  }
  limit(n: number) {
    this.limitValue = n;
    return this;
  }
  maybeSingle(): PromiseLike<Result<any>> {
    this.singleMode = "maybe";
    return this as unknown as PromiseLike<Result<any>>;
  }
  single(): PromiseLike<Result<any>> {
    this.singleMode = "one";
    return this as unknown as PromiseLike<Result<any>>;
  }

  private run(): Result<any> {
    const rows = table(this.tableName);
    const stamp = new Date().toISOString();
    let affected: Row[] = [];

    if (this.mode === "insert") {
      affected = this.payload.map((v) => {
        const row: Row = { id: uid(), created_at: stamp, updated_at: stamp, ...v };
        rows.push(row);
        return row;
      });
    } else if (this.mode === "update") {
      affected = rows.filter((r) => matches(r, this.filters));
      for (const row of affected) Object.assign(row, this.payload[0], { updated_at: stamp });
    } else if (this.mode === "upsert") {
      affected = this.payload.map((v) => {
        const existing = rows.find((r) => this.conflict.every((c) => r[c] === v[c]));
        if (existing) {
          Object.assign(existing, v, { updated_at: stamp });
          return existing;
        }
        const row: Row = { id: uid(), created_at: stamp, updated_at: stamp, ...v };
        rows.push(row);
        return row;
      });
    } else if (this.mode === "delete") {
      affected = rows.filter((r) => matches(r, this.filters));
      const db = getDb();
      db[this.tableName] = rows.filter((r) => !affected.includes(r));
    } else {
      affected = rows.filter((r) => matches(r, this.filters));
      for (const o of [...this.orders].reverse()) {
        affected = [...affected].sort((a, b) => compare(a[o.column], b[o.column], o.ascending, o.nullsFirst));
      }
      if (this.limitValue !== null) affected = affected.slice(0, this.limitValue);
    }

    if (this.mode !== "select") persist();

    const count = affected.length;
    if (this.headOnly) return { data: null, error: null, count };

    const cloned = affected.map((r) => ({ ...r }));
    if (this.singleMode) {
      const first = cloned[0] ?? null;
      if (!first && this.singleMode === "one") {
        return { data: null, error: { message: "No rows found" }, count: 0 };
      }
      return { data: first, error: null, count };
    }
    if (this.mode !== "select" && !this.returnRows) return { data: null, error: null, count };
    return { data: cloned, error: null, count: this.wantCount ? count : null };
  }

  then<TResult1 = Result<any[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    let result: Result<any>;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    try {
      result = this.run();
    } catch (err) {
      result = { data: null, error: { message: err instanceof Error ? err.message : "Demo error" } };
    }
    return Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

/* ---------------------------------- rpc ---------------------------------- */

function rpc(fn: string, args: Record<string, any> = {}): Promise<{ data: any; error: null }> {
  const actorId = getDemoUserId();
  const userId = (args["_user_id"] as string) ?? actorId;
  const roles = demoRoles(userId ?? null);
  const actorRoles = demoRoles(actorId);
  const admin = actorRoles.includes("administrator");
  let data: any = null;
  if (fn === "has_role") {
    data = userId === actorId && String(args["_role"]) !== "developer" && roles.includes(String(args["_role"]));
  } else if (fn === "is_recruiting_staff") {
    data = userId === actorId && (roles.includes("administrator") || roles.includes("recruiter"));
  } else if (fn === "is_content_staff") {
    data = userId === actorId && (roles.includes("administrator") || roles.includes("content_manager"));
  } else if (fn === "admin_set_user_role") {
    const targetId = String(args["_user_id"]);
    const role = String(args["_role"]);
    const grant = args["_grant"] === true;
    const targetRoles = demoRoles(targetId);
    if (
      admin &&
      targetId !== actorId &&
      role !== "developer" &&
      !(grant && targetRoles.includes("developer"))
    ) {
      const roleRows = table("user_roles");
      if (grant && !targetRoles.includes(role)) {
        roleRows.push({ id: uid(), user_id: targetId, role, granted_by: actorId });
      } else if (!grant) {
        const db = getDb();
        db["user_roles"] = roleRows.filter((row) => row["user_id"] !== targetId || row["role"] !== role);
      }
      table("audit_logs").push({
        id: uid(),
        actor_id: actorId,
        actor_email: DEMO_USERS.find((user) => user.id === actorId)?.email ?? null,
        action: grant ? "role_granted" : "role_revoked",
        target_type: "user",
        target_id: targetId,
        metadata: { role },
        created_at: new Date().toISOString(),
      });
      persist();
      data = true;
    } else data = false;
  }
  return Promise.resolve({ data, error: null });
}

/* -------------------------------- storage -------------------------------- */

const uploadedFiles = new Map<string, string>();

const storage = {
  from(_bucket: string) {
    return {
      async upload(path: string, file: File | Blob) {
        const url = typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(file as Blob) : "";
        uploadedFiles.set(path, url);
        return { data: { path }, error: null };
      },
      async createSignedUrl(path: string, _expires: number) {
        const url = uploadedFiles.get(path) ?? "";
        if (!url) {
          return {
            data: null,
            error: { message: "This is demo data — no file was actually uploaded for this record." },
          };
        }
        return { data: { signedUrl: url }, error: null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: uploadedFiles.get(path) ?? "" } };
      },
      async remove(paths: string[]) {
        paths.forEach((p) => uploadedFiles.delete(p));
        return { data: null, error: null };
      },
    };
  },
};

/* --------------------------------- auth ---------------------------------- */

const auth = {
  async getUser() {
    const user = getDemoUser();
    return { data: { user }, error: user ? null : { message: "Not signed in" } };
  },
  async getSession() {
    const user = getDemoUser();
    return { data: { session: user ? { user, access_token: "demo-token" } : null }, error: null };
  },
  async signOut() {
    setDemoUserId(null);
    return { error: null };
  },
};

export const demoClient = {
  from: (tableName: string) => new QueryBuilder(tableName),
  rpc,
  storage,
  auth,
};

export type DemoClient = typeof demoClient;
