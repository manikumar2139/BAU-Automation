"use client";

import { useMemo, useState } from "react";
import type { Category, ScanResult, Severity } from "@/lib/scanner";

const SAMPLES = ["www.broadridge.com", "www.vercel.com", "nextjs.org"];

const SEVERITY_LABEL: Record<Severity, string> = {
  pass: "Pass",
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  pass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  low: "bg-amber-50 text-amber-700 ring-amber-200",
  medium: "bg-orange-50 text-orange-700 ring-orange-200",
  high: "bg-red-50 text-red-700 ring-red-200",
  critical: "bg-red-100 text-red-800 ring-red-300",
};

const CATEGORY_OPTIONS: (Category | "All" | "Fail" | "Warn" | "all")[] = [
  "All",
  "Fail",
  "Warn",
  "all",
  "SEO",
  "Metadata",
  "Social",
  "Content",
  "Accessibility",
  "Functionality",
  "Pass",
  "Info" as never,
  "Links",
  "Technical",
  "Performance",
  "Mobile",
];

export default function QAScanner() {
  const [url, setUrl] = useState("");
  const [validateLinks, setValidateLinks] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"checks" | "links" | "images" | "headings" | "metadata">("checks");

  async function runScan() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setOpen({});
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          validateLinks,
          username: showAuth ? username || undefined : undefined,
          password: showAuth ? password || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
      setTab("checks");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filteredChecks = useMemo(() => {
    if (!result) return [];
    return result.checks.filter((c) => {
      if (filter === "All") {
        // All except pass/info? Reference seems to show everything; keep all.
      } else if (filter === "Fail") {
        if (!(c.severity === "high" || c.severity === "critical")) return false;
      } else if (filter === "Warn") {
        if (!(c.severity === "medium" || c.severity === "low")) return false;
      } else if (filter === "all") {
        // alias: literal 'all'
      } else if (filter === "Pass") {
        if (c.severity !== "pass") return false;
      } else if (filter === "Info") {
        if (c.severity !== "info") return false;
      } else {
        if (c.category !== filter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.message.toLowerCase().includes(q) &&
          !c.category.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [result, filter, search]);

  function exportJSON() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qa-report-${new URL(result.finalUrl).hostname}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
          Run a deep QA scan on any webpage
        </h2>
        <p className="mt-2 text-muted-foreground text-pretty max-w-2xl">
          Checks UI, links, accessibility, SEO, metadata, content quality, and more across 40+ validations.
        </p>

        {/* Form card */}
        <div className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <label htmlFor="url" className="block text-sm font-medium">
            Webpage URL
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <GlobeIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runScan();
                }}
                placeholder="https://www.broadridge.com"
                className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30"
              />
            </div>
            <button
              onClick={runScan}
              disabled={loading || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <SearchIcon className="size-4" />
                  Run Deep Scan
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => setShowAuth((s) => !s)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition"
          >
            <LockIcon className="size-3.5 text-muted-foreground" />
            <span>Protected / dev URL? Add credentials (optional)</span>
            <ChevronDownIcon className={`size-4 text-muted-foreground transition ${showAuth ? "rotate-180" : ""}`} />
          </button>

          {showAuth && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <label className="mt-4 flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={validateLinks}
              onChange={(e) => setValidateLinks(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input accent-foreground"
            />
            <span className="text-sm font-medium">
              Validate all links (HTTP status, redirects, broken — slower)
            </span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Try:</span>
            {SAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => setUrl(`https://${s}`)}
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!result && !loading && <FeatureCards />}

        {loading && <LoadingState />}

        {result && (
          <ResultsView
            result={result}
            filter={filter}
            setFilter={setFilter}
            search={search}
            setSearch={setSearch}
            filteredChecks={filteredChecks}
            open={open}
            setOpen={setOpen}
            tab={tab}
            setTab={setTab}
            onExport={exportJSON}
          />
        )}
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-muted-foreground">
          QA Scanner — built for internal teams to self-QA web pages before formal review.
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          <ShieldIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">QA Scanner</h1>
          <p className="text-xs text-muted-foreground">Self-service web page quality assurance</p>
        </div>
      </div>
    </header>
  );
}

function FeatureCards() {
  const items = [
    {
      title: "40+ QA Checks",
      desc: "SEO, metadata, accessibility, content quality, links, performance, and technical validation.",
    },
    {
      title: "Deep Link Analysis",
      desc: "Validates every link, detects broken URLs, redirects, missing target attributes, and security issues.",
    },
    {
      title: "Actionable Report",
      desc: "Severity-tagged findings with evidence and suggested fixes. Export as JSON for tickets.",
    },
  ];
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it) => (
        <div key={it.title} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">{it.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-10 flex flex-col items-center text-center">
      <SpinnerIcon className="size-6 animate-spin text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Running deep scan…</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fetching the page, parsing markup, and validating links. This can take up to a minute.
      </p>
    </div>
  );
}

function ResultsView({
  result,
  filter,
  setFilter,
  search,
  setSearch,
  filteredChecks,
  open,
  setOpen,
  tab,
  setTab,
  onExport,
}: {
  result: ScanResult;
  filter: string;
  setFilter: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  filteredChecks: ScanResult["checks"];
  open: Record<string, boolean>;
  setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  tab: "checks" | "links" | "images" | "headings" | "metadata";
  setTab: (t: "checks" | "links" | "images" | "headings" | "metadata") => void;
  onExport: () => void;
}) {
  const s = result.summary;
  const total = result.checks.length;
  const scoreColor =
    s.score >= 90 ? "text-emerald-600" : s.score >= 70 ? "text-amber-600" : "text-red-600";

  const headings = result.checks.filter((c) => c.id === "heading-hierarchy" || c.id === "h1" || c.id === "main-subheading" || c.id === "body-subheadings");
  const metadata = result.checks.filter((c) => c.category === "Metadata" || c.id === "canonical" || c.id === "robots");

  return (
    <div className="mt-6 space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">QA Score</div>
          <div className="mt-2 flex items-end gap-3">
            <div className={`text-4xl font-semibold ${scoreColor}`}>{s.score}</div>
            <div className="pb-1.5 text-xs text-muted-foreground">out of 100</div>
            <div className="ml-auto pb-1">
              <Gauge value={s.score} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Checks</div>
          <div className="mt-2 text-3xl font-semibold">{total}</div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Dot className="bg-emerald-500" /> {s.pass} pass
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Dot className="bg-amber-500" /> {s.warn} warn
            </span>
            <span className="inline-flex items-center gap-1 text-red-700">
              <Dot className="bg-red-500" /> {s.fail} fail
            </span>
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Dot className="bg-blue-500" /> {s.info} info
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Severity</div>
          <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
            <span className="text-red-700">Critical</span>
            <span className="text-right font-medium">{s.critical}</span>
            <span className="text-red-600">High</span>
            <span className="text-right font-medium">{s.high}</span>
            <span className="text-amber-600">Medium</span>
            <span className="text-right font-medium">{s.medium}</span>
            <span className="text-muted-foreground">Low</span>
            <span className="text-right font-medium">{s.low}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Page</div>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <ClockIcon className="size-3.5 text-muted-foreground" />
              <span>{result.loadMs}ms load</span>
            </div>
            <div className="flex items-center gap-2">
              <FileIcon className="size-3.5 text-muted-foreground" />
              <span>{Math.round(result.bytes / 1024)} KB</span>
            </div>
            <div className="flex items-center gap-2">
              <LinkIcon className="size-3.5 text-muted-foreground" />
              <span>{result.links.length} links</span>
            </div>
            <div className="flex items-center gap-2">
              <Dot className={result.httpStatus < 400 ? "bg-emerald-500" : "bg-red-500"} />
              <span>HTTP {result.httpStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap gap-2">
          {(["checks", "links", "images", "headings", "metadata"] as const).map((t) => {
            const counts: Record<typeof t, number> = {
              checks: result.checks.length,
              links: result.links.length,
              images: 0,
              headings: headings.length,
              metadata: metadata.length,
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  tab === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                <span className="capitalize">{t}</span>
                <span className="ml-2 text-xs opacity-70">({counts[t]})</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition"
        >
          <DownloadIcon className="size-4" />
          Export JSON
        </button>
      </div>

      {tab === "checks" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 md:p-5 border-b border-border">
            <h3 className="text-base font-semibold">QA Checks</h3>
            <div className="mt-3 flex flex-col md:flex-row gap-3">
              <div className="relative md:w-72">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search checks..."
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "All",
                  "Fail",
                  "Warn",
                  "all",
                  "SEO",
                  "Metadata",
                  "Social",
                  "Content",
                  "Accessibility",
                  "Functionality",
                  "Pass",
                  "Info",
                  "Links",
                  "Technical",
                  "Performance",
                  "Mobile",
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      filter === c
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground hover:bg-accent"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ul className="divide-y divide-border">
            {filteredChecks.map((c, i) => {
              const key = `${c.id}-${i}`;
              const isOpen = open[key];
              return (
                <li key={key}>
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                    className="w-full flex items-start gap-3 px-4 md:px-5 py-3 text-left hover:bg-accent/50 transition"
                  >
                    <SeverityIcon severity={c.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge label={c.category} tone="muted" />
                        {c.severity !== "pass" && c.severity !== "info" && (
                          <Badge label={SEVERITY_LABEL[c.severity].toLowerCase()} tone={c.severity} />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{c.message}</p>
                    </div>
                    <ChevronDownIcon
                      className={`size-4 text-muted-foreground mt-1 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (c.evidence || c.detail || c.fix) && (
                    <div className="px-4 md:px-5 pb-4 pl-12 text-sm space-y-2">
                      {c.evidence && (
                        <div>
                          <span className="text-xs font-semibold uppercase text-muted-foreground">Evidence</span>
                          <pre className="mt-1 rounded-md bg-muted px-3 py-2 text-xs whitespace-pre-wrap break-words">
                            {c.evidence}
                          </pre>
                        </div>
                      )}
                      {c.detail && <p className="text-muted-foreground">{c.detail}</p>}
                      {c.fix && (
                        <div>
                          <span className="text-xs font-semibold uppercase text-muted-foreground">Suggested fix</span>
                          <p className="mt-1">{c.fix}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {filteredChecks.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                No checks match your filter.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "links" && <LinksTable result={result} />}
      {tab === "headings" && <ChecksList items={headings} title="Headings" />}
      {tab === "metadata" && <ChecksList items={metadata} title="Metadata" />}
      {tab === "images" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Image inventory is not exposed in this view. See Image Alt Text in QA Checks.
        </div>
      )}
    </div>
  );
}

function ChecksList({ items, title }: { items: ScanResult["checks"]; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 md:p-5 border-b border-border">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <ul className="divide-y divide-border">
        {items.map((c, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-3">
            <SeverityIcon severity={c.severity} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                <Badge label={c.category} tone="muted" />
              </div>
              <p className="text-sm text-muted-foreground">{c.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinksTable({ result }: { result: ScanResult }) {
  if (result.links.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Link validation was disabled. Re-run with &quot;Validate all links&quot; enabled.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 md:p-5 border-b border-border">
        <h3 className="text-base font-semibold">Links ({result.links.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Scope</th>
              <th className="px-4 py-2 font-medium">URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.links.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="px-4 py-2">
                  {l.error ? (
                    <Badge label="error" tone="high" />
                  ) : l.status === null ? (
                    <Badge label="—" tone="muted" />
                  ) : l.ok ? (
                    <Badge label={String(l.status)} tone="pass" />
                  ) : (
                    <Badge label={String(l.status)} tone="high" />
                  )}
                </td>
                <td className="px-4 py-2 text-xs uppercase">{l.type}</td>
                <td className="px-4 py-2 text-xs">{l.internal ? "Internal" : "External"}</td>
                <td className="px-4 py-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline break-all">
                    {l.url}
                  </a>
                  {l.error && <div className="text-xs text-red-600 mt-0.5">{l.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Small UI primitives ---------- */

function Badge({ label, tone }: { label: string; tone: Severity | "muted" }) {
  const cls =
    tone === "muted"
      ? "bg-muted text-muted-foreground ring-border"
      : SEVERITY_BADGE[tone];
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function Dot({ className = "" }: { className?: string }) {
  return <span className={`inline-block size-2 rounded-full ${className}`} />;
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "pass")
    return (
      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckIcon className="size-3" />
      </span>
    );
  if (severity === "info")
    return (
      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        <InfoIcon className="size-3" />
      </span>
    );
  if (severity === "low" || severity === "medium")
    return (
      <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertTriangleIcon className="size-3" />
      </span>
    );
  return (
    <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-red-100 text-red-700">
      <AlertCircleIcon className="size-3" />
    </span>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const stroke = value >= 90 ? "#10b981" : value >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r={r} stroke="#e5e7eb" strokeWidth="5" fill="none" />
      <circle
        cx="28"
        cy="28"
        r={r}
        stroke={stroke}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

/* ---------- Icons (inline SVG, no external deps) ---------- */

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
  );
}
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" /> <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function SpinnerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
}
function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" /> <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}
function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /> <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /> <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" />
    </svg>
  );
}
function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /> <path d="M14 2v6h6" />
    </svg>
  );
}
function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="M7 10l5 5 5-5" /> <path d="M12 15V3" />
    </svg>
  );
}
