import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  archiveResource,
  duplicateResource,
  listResource,
  reorderResource,
  saveResource,
  type ResourceKey,
  type ResourceRow,
} from "@/lib/ops.functions";
import type { FieldDef, ResourceView } from "@/lib/resource-fields";
import { EmptyState, ErrorState, StatusBadge, TableSkeleton } from "@/components/portal/ui";

/* ------------------------------ field control ----------------------------- */

const inputClass =
  "w-full min-h-11 rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function toInputValue(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (field.type === "list") return Array.isArray(value) ? value.join("\n") : String(value);
  if (field.type === "datetime" && typeof value === "string") return value.slice(0, 16);
  if (field.type === "date" && typeof value === "string") return value.slice(0, 10);
  return String(value);
}

function fromInputValue(field: FieldDef, raw: string): unknown {
  if (field.type === "number") return raw === "" ? null : Number(raw);
  if (field.type === "list")
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  if (field.type === "datetime") return raw ? new Date(raw).toISOString() : null;
  return raw === "" ? null : raw;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const id = `field-${field.name}`;
  if (field.type === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        {field.label}
      </label>
    );
  }

  const shared = {
    id,
    value: toInputValue(field, value),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(fromInputValue(field, e.target.value)),
    className: inputClass,
    required: field.required,
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold tracking-wide uppercase">
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select {...shared}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" || field.type === "richtext" || field.type === "list" ? (
        <textarea {...shared} rows={field.type === "richtext" ? 10 : 4} />
      ) : (
        <input
          {...shared}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text"}
        />
      )}
      {field.help ? <p className="mt-1 text-xs text-muted-foreground">{field.help}</p> : null}
      {field.type === "list" ? (
        <p className="mt-1 text-xs text-muted-foreground">One entry per line.</p>
      ) : null}
    </div>
  );
}

/* ------------------------------- component -------------------------------- */

export function ResourceManager({
  resource,
  view,
}: {
  resource: ResourceKey;
  view: ResourceView;
}) {
  const fetchRows = useServerFn(listResource);
  const save = useServerFn(saveResource);
  const archive = useServerFn(archiveResource);
  const duplicate = useServerFn(duplicateResource);
  const reorder = useServerFn(reorderResource);
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ResourceRow | "new" | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const key = ["ops-resource", resource];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => fetchRows({ data: { resource } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; values: Record<string, unknown> }) =>
      save({ data: { resource, ...payload } }),
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
      toast.success(`${view.title} saved`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const filtered = all.filter((r) => {
      const archived = Boolean(r["archived_at"]);
      if (archived !== showArchived && view.archivable) return false;
      if (!query) return true;
      return Object.values(r).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(query.toLowerCase()),
      );
    });
    return filtered;
  }, [data, query, showArchived, view.archivable]);

  const columns = view.fields.filter((f) => f.column);

  function openEditor(row: ResourceRow | "new") {
    setEditing(row);
    setDraft(row === "new" ? {} : { ...row });
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...rows];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    const b = next[target]!;
    try {
      await reorder({
        data: {
          resource,
          order: [
            { id: String(a["id"]), sort_order: Number(b["sort_order"] ?? target) },
            { id: String(b["id"]), sort_order: Number(a["sort_order"] ?? index) },
          ],
        },
      });
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder");
    }
  }

  async function runAction(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      await invalidate();
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  if (isLoading) return <TableSkeleton rows={8} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const idColumn = resource === "site_settings" ? "key" : "id";

  return (
    <div>
      {/* command bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border-y border-border py-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="resource-search" className="sr-only">
            Search {view.title}
          </label>
          <input
            id="resource-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${view.title.toLowerCase()}…`}
            className={`${inputClass} pl-9`}
          />
        </div>
        <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {rows.length} record{rows.length === 1 ? "" : "s"}
        </p>
        {view.archivable ? (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-pressed={showArchived}
            className="min-h-11 rounded-sm border border-input px-3 text-xs font-semibold tracking-wide uppercase hover:bg-secondary"
          >
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
        ) : null}
        {!view.createDisabled ? (
          <button
            type="button"
            onClick={() => openEditor("new")}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-accent px-4 text-sm font-semibold text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            New
          </button>
        ) : null}
      </div>

      {!rows.length ? (
        <EmptyState
          title={query ? "No records match your current filters." : `No ${view.title.toLowerCase()} yet.`}
        />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">{view.title}</caption>
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left">
                {columns.map((c) => (
                  <th
                    key={c.name}
                    scope="col"
                    className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase"
                  >
                    {c.label}
                  </th>
                ))}
                {view.statusField ? (
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">
                    Status
                  </th>
                ) : null}
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row[idColumn])} className="border-b border-border last:border-0 hover:bg-surface-2">
                  {columns.map((c) => {
                    const value = row[c.name];
                    return (
                      <td key={c.name} className={`px-3 py-2.5 align-top ${c.wide ? "max-w-sm" : ""}`}>
                        {c.type === "boolean" ? (
                          <span className="font-mono text-xs uppercase">{value ? "Yes" : "No"}</span>
                        ) : (
                          <span className={c.wide ? "line-clamp-2 text-muted-foreground" : ""}>
                            {value === null || value === undefined || value === ""
                              ? "—"
                              : Array.isArray(value)
                                ? value.length
                                : String(value)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {view.statusField ? (
                    <td className="px-3 py-2.5 align-top">
                      <StatusBadge status={String(row[view.statusField] ?? "draft")} />
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {view.orderable ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void move(i, -1)}
                            disabled={i === 0}
                            aria-label={`Move ${String(row[view.primary])} up`}
                            className="inline-flex size-9 items-center justify-center rounded-sm border border-input disabled:opacity-40"
                          >
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void move(i, 1)}
                            disabled={i === rows.length - 1}
                            aria-label={`Move ${String(row[view.primary])} down`}
                            className="inline-flex size-9 items-center justify-center rounded-sm border border-input disabled:opacity-40"
                          >
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          </button>
                        </>
                      ) : null}
                      {view.duplicable ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              () => duplicate({ data: { resource, id: String(row["id"]) } }),
                              "Duplicated as a draft",
                            )
                          }
                          aria-label={`Duplicate ${String(row[view.primary])}`}
                          className="inline-flex size-9 items-center justify-center rounded-sm border border-input"
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                      {view.archivable ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              () =>
                                archive({
                                  data: { resource, id: String(row["id"]), restore: showArchived },
                                }),
                              showArchived ? "Restored" : "Archived",
                            )
                          }
                          aria-label={`${showArchived ? "Restore" : "Archive"} ${String(row[view.primary])}`}
                          className="inline-flex size-9 items-center justify-center rounded-sm border border-input"
                        >
                          {showArchived ? (
                            <RotateCcw className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Archive className="size-3.5" aria-hidden="true" />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEditor(row)}
                        className="min-h-9 rounded-sm border border-input px-3 text-xs font-semibold uppercase hover:bg-secondary"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* editor drawer */}
      <AnimatePresence>
        {editing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40"
            onClick={() => setEditing(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${editing === "new" ? "New" : "Edit"} ${view.title}`}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-dvh w-full max-w-2xl flex-col overflow-y-auto bg-surface shadow-xl"
            >
              <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
                <div>
                  <p className="eyebrow text-accent">{view.eyebrow}</p>
                  <h2 className="text-lg font-bold">
                    {editing === "new" ? `New ${view.title.toLowerCase()}` : String(editing[view.primary] ?? "Edit")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  aria-label="Close editor"
                  className="inline-flex size-11 items-center justify-center rounded-sm border border-input"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </header>

              <form
                className="flex-1 space-y-4 px-5 py-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate({
                    id: editing === "new" ? undefined : String(editing[idColumn]),
                    values: draft,
                  });
                }}
              >
                {view.fields.map((f) => (
                  <Field
                    key={f.name}
                    field={f}
                    value={draft[f.name]}
                    onChange={(next) => setDraft((d) => ({ ...d, [f.name]: next }))}
                  />
                ))}
                <div className="sticky bottom-0 flex gap-3 border-t border-border bg-surface py-4">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="min-h-11 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {saveMutation.isPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="min-h-11 rounded-sm border border-input px-5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
