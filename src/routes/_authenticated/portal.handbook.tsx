import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@/lib/mock/server-fn";
import {
  getHandbook,
  signHandbook,
  getHandbookDownload,
  getHandbookReceipt,
  handbookStatement,
} from "@/lib/handbook.functions";
import { useSession } from "@/lib/session";
import { PortalHeading } from "@/components/portal/PortalShell";
import { AccessDenied, EmptyState, ErrorState, Panel, TableSkeleton } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/portal/handbook")({
  head: () => ({
    meta: [
      { title: "Driver Handbook — 52 Logistics Portal" },
      { name: "description", content: "Read and acknowledge the current driver handbook." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HandbookPage,
});

type Version = {
  id: string;
  title: string;
  version_label: string;
  effective_date?: string | null;
  requires_signature?: boolean;
  description?: string | null;
  change_summary?: string | null;
};
type Section = { id: string; title: string; body: string; category?: string | null };
type Signature = {
  id: string;
  handbook_version_id: string;
  signature_name: string;
  signed_at: string;
  statement: string;
  content_hash: string;
  version_label: string;
  handbook_title: string;
  effective_date: string | null;
};
type Handbook = {
  version: Version | null;
  sections: Section[];
  signature: Signature | null;
  history: Signature[];
  canSign: boolean;
};

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Not specified";
  const date = new Date(
    !withTime && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
  return Number.isNaN(date.getTime())
    ? value
    : withTime
      ? date.toLocaleString()
      : date.toLocaleDateString();
}

function escapeHtml(value: unknown) {
  return String(value ?? "Not provided").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function downloadFile(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadReceipt(receipt: Signature, driverName: string | undefined) {
  const fields = [
    ["Driver name", driverName],
    ["Typed signature name", receipt.signature_name],
    ["Handbook", receipt.handbook_title],
    ["Version", receipt.version_label],
    ["Effective date", receipt.effective_date],
    ["Signed at", formatDate(receipt.signed_at, true)],
    ["Acknowledgement", receipt.statement],
    ["Hash", receipt.content_hash],
  ];
  const rows = fields
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  downloadFile(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Handbook acknowledgement receipt</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#111;max-width:740px;margin:3rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ccc;padding:.75rem;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{width:12rem}@media print{body{margin:0}}</style></head><body><h1>Handbook acknowledgement receipt</h1><table>${rows}</table></body></html>`,
    "handbook-acknowledgement.html",
  );
}

function HandbookPage() {
  const { user, roles, isDriver, isLoading: sessionLoading } = useSession();
  const isContent = roles.includes("administrator") || roles.includes("content_manager");
  const fetchHandbook = useServerFn(getHandbook);
  const submitSignature = useServerFn(signHandbook);
  const fetchDownload = useServerFn(getHandbookDownload);
  const fetchReceipt = useServerFn(getHandbookReceipt);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["handbook", user?.id],
    queryFn: async () => (await fetchHandbook()) as Handbook,
    enabled: isDriver || isContent,
  });
  const data = query.data;

  async function handleSign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !data?.version ||
      !data.canSign ||
      !isDriver ||
      !agreed ||
      name.trim().length < 2 ||
      signing
    )
      return;
    setSigning(true);
    try {
      await submitSignature({
        data: { version_id: data.version.id, signature_name: name.trim(), agreed },
      });
      await queryClient.invalidateQueries({ queryKey: ["handbook"] });
      toast.success("Handbook acknowledged.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign the handbook.");
    } finally {
      setSigning(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await fetchDownload();
      if (result.url) {
        const url = new URL(result.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("The handbook download link is invalid.");
        }
        const link = document.createElement("a");
        link.href = url.href;
        link.download = "driver-handbook";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (result.html) {
        downloadFile(result.html, "driver-handbook.html");
      } else {
        throw new Error("No handbook download is available.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the handbook.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleReceipt(id: string) {
    setReceiptId(id);
    try {
      const receipt = (await fetchReceipt({ data: { id } })) as Signature;
      downloadReceipt(receipt, user?.user_metadata.full_name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the receipt.");
    } finally {
      setReceiptId(null);
    }
  }

  if (sessionLoading) return <TableSkeleton rows={6} />;
  if (!isDriver && !isContent) return <AccessDenied need="driver or content management" />;

  const version = data?.version;
  const signature = data?.signature;
  const staffPreview = !isDriver;
  const downloadAllowed = isDriver && !!version && !!signature;

  return (
    <div>
      <PortalHeading
        eyebrow="Operations"
        title="Driver handbook"
        blurb={
          staffPreview
            ? "Preview the current published handbook."
            : "Read the current handbook and acknowledge your responsibilities."
        }
      />
      {query.isLoading ? (
        <TableSkeleton rows={8} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !version ? (
        <EmptyState
          title="No current handbook"
          blurb="A published handbook is not available yet."
        />
      ) : (
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-accent">Current edition</p>
                <h2 className="mt-2 text-2xl font-bold">{version.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Version {version.version_label} · Effective {formatDate(version.effective_date)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {version.requires_signature ? <Badge>Signature required</Badge> : null}
                {isDriver ? (
                  signature ? (
                    <Badge variant="secondary">Signed</Badge>
                  ) : (
                    <Badge>Action required</Badge>
                  )
                ) : null}
                {staffPreview ? <Badge variant="outline">Staff preview</Badge> : null}
              </div>
            </div>
            {version.change_summary || version.description ? (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Change summary</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {version.change_summary || version.description}
                </p>
              </div>
            ) : null}
          </Panel>

          {isDriver && !signature ? (
            <div
              role="status"
              className="rounded-sm border border-accent/40 bg-accent/10 px-5 py-4 text-sm"
            >
              <p className="font-semibold">Action required</p>
              <p className="mt-1">Read and acknowledge this handbook before downloading it.</p>
            </div>
          ) : null}

          <Panel title="Handbook contents">
            {!data.sections.length ? (
              <EmptyState title="No handbook sections published" />
            ) : (
              <div className="divide-y divide-border">
                {data.sections.map((section) => (
                  <article key={section.id} className="py-5 first:pt-0 last:pb-0">
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                    {section.category ? (
                      <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">
                        {section.category}
                      </p>
                    ) : null}
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                      {section.body}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          {isDriver ? (
            <Panel title="Acknowledgement">
              {signature ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <FileCheck2 className="size-4 text-emerald-700" aria-hidden="true" /> Signed by{" "}
                    {signature.signature_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Signed on {formatDate(signature.signed_at, true)}
                  </p>
                </div>
              ) : data.canSign ? (
                <form onSubmit={handleSign} className="space-y-5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="handbook-agree"
                      checked={agreed}
                      onCheckedChange={(checked) => setAgreed(checked === true)}
                    />
                    <Label
                      htmlFor="handbook-agree"
                      className="cursor-pointer text-sm leading-relaxed"
                    >
                      {handbookStatement(version.version_label)}
                    </Label>
                  </div>
                  <div className="max-w-md space-y-2">
                    <Label htmlFor="handbook-name">Type your full legal name to sign</Label>
                    <Input
                      id="handbook-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={!agreed || name.trim().length < 2 || signing}>
                    {signing ? "Signing…" : "Sign handbook"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No acknowledgement is available for this handbook.
                </p>
              )}
              <div className="mt-5 border-t border-border pt-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!downloadAllowed || downloading}
                  onClick={() => void handleDownload()}
                >
                  <Download aria-hidden="true" />
                  {downloading ? "Preparing…" : "Download handbook"}
                </Button>
                {!downloadAllowed ? (
                  <p className="mt-2 text-xs text-muted-foreground">Sign to unlock the download</p>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      )}
      {isDriver && data && !query.error ? (
        <Panel title="Signature history" className="mt-6">
          {!data.history.length ? (
            <p className="text-sm text-muted-foreground">No previous acknowledgements.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.version_label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Signed on {formatDate(item.signed_at, true)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={receiptId !== null}
                    onClick={() => void handleReceipt(item.id)}
                  >
                    <BookOpen aria-hidden="true" />
                    {receiptId === item.id ? "Preparing…" : "Download signed receipt"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
