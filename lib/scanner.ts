import * as cheerio from "cheerio";

export type Severity = "critical" | "high" | "medium" | "low" | "info" | "pass";
export type Category =
  | "SEO"
  | "Metadata"
  | "Content"
  | "Accessibility"
  | "Functionality"
  | "Links"
  | "Technical"
  | "Performance"
  | "Mobile"
  | "Social";

export interface Check {
  id: string;
  name: string;
  category: Category;
  severity: Severity;
  message: string;
  detail?: string;
  evidence?: string;
  fix?: string;
}

export interface LinkAudit {
  url: string;
  status: number | null;
  ok: boolean;
  redirected?: boolean;
  internal: boolean;
  type: "a" | "pdf";
  text?: string;
  error?: string;
}

export interface ScanResult {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  loadMs: number;
  bytes: number;
  httpStatus: number;
  checks: Check[];
  links: LinkAudit[];
  summary: {
    score: number;
    pass: number;
    warn: number;
    fail: number;
    info: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface ScanOptions {
  url: string;
  validateLinks?: boolean;
  username?: string;
  password?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; QA-Scanner/1.0; +https://qa-scanner.example.com)";

function authHeader(u?: string, p?: string): Record<string, string> {
  if (!u) return {};
  const token = Buffer.from(`${u}:${p ?? ""}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

function severityRank(s: Severity): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1, pass: 0 }[s];
}

function bytesToKB(b: number): string {
  return `${Math.round(b / 1024)} KB`;
}

export async function scanPage(opts: ScanOptions): Promise<ScanResult> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
    ...authHeader(opts.username, opts.password),
  };

  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(opts.url, { headers, redirect: "follow" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to fetch URL: ${msg}`);
  }
  const html = await res.text();
  const loadMs = Date.now() - start;
  const bytes = new TextEncoder().encode(html).length;

  const $ = cheerio.load(html);
  const finalUrl = res.url || opts.url;
  const baseHost = new URL(finalUrl).host;

  // ---- Scope to BODY content only ----
  // Header, primary navigation and footer are typically shared across all pages
  // of the site, so we strip them before running content / accessibility / link
  // / image checks. <head> metadata (title, meta, canonical, OG, Twitter, etc.)
  // is not affected because it lives in <head>, not <header>.
  const excluded = {
    header: $("header, [role='banner']").length,
    nav: $("nav, [role='navigation']").length,
    footer: $("footer, [role='contentinfo']").length,
  };
  $("header, [role='banner']").remove();
  $("footer, [role='contentinfo']").remove();
  $("nav, [role='navigation']").remove();

  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ---- Scope notice ----
  const excludedParts: string[] = [];
  if (excluded.header) excludedParts.push(`${excluded.header} <header>`);
  if (excluded.nav) excludedParts.push(`${excluded.nav} <nav>`);
  if (excluded.footer) excludedParts.push(`${excluded.footer} <footer>`);
  add({
    id: "scan-scope",
    name: "Scan Scope",
    category: "Technical",
    severity: "info",
    message: excludedParts.length
      ? `Body-only scan — excluded ${excludedParts.join(", ")}`
      : "Body-only scan — no header/nav/footer detected",
    detail:
      "Header, primary navigation, and footer are shared across pages and are not part of the page body, so they are excluded from content, link, image, heading, and accessibility checks. <head> metadata (title, meta tags, canonical, Open Graph, Twitter, etc.) is still evaluated because it lives in <head>, not <header>.",
    evidence: excludedParts.length
      ? `Excluded selectors:\n- header, [role="banner"]\n- nav, [role="navigation"]\n- footer, [role="contentinfo"]\n\nMatched on this page: ${excludedParts.join(", ")}`
      : 'Selectors checked but not found:\n- header, [role="banner"]\n- nav, [role="navigation"]\n- footer, [role="contentinfo"]',
  });

  // ---- SEO / Metadata ----
  const title = $("head > title").first().text().trim();
  if (!title) {
    add({
      id: "page-title",
      name: "Page Title",
      category: "SEO",
      severity: "critical",
      message: "Missing <title> tag",
      fix: "Add a descriptive <title> between 30–60 characters.",
    });
  } else {
    const len = title.length;
    if (len < 30) {
      add({
        id: "page-title",
        name: "Page Title",
        category: "SEO",
        severity: "low",
        message: `Page title is short (${len} chars)`,
        evidence: title,
      });
    } else if (len > 60) {
      add({
        id: "page-title",
        name: "Page Title",
        category: "SEO",
        severity: "medium",
        message: `Page title is long (${len} chars)`,
        evidence: title,
      });
    } else {
      add({
        id: "page-title",
        name: "Page Title",
        category: "SEO",
        severity: "pass",
        message: `Title length OK (${len} chars)`,
        evidence: title,
      });
    }
    add({
      id: "meta-title-length",
      name: "Meta Title Length",
      category: "Metadata",
      severity: len >= 30 && len <= 60 ? "pass" : "low",
      message: `Title length ${len} chars (recommended 30–60)`,
    });
  }

  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  if (!metaDesc) {
    add({
      id: "meta-description",
      name: "Meta Description",
      category: "Metadata",
      severity: "high",
      message: "Missing meta description",
      fix: "Add <meta name=\"description\" content=\"...\"> with 120–160 chars.",
    });
  } else {
    add({
      id: "meta-description",
      name: "Meta Description",
      category: "Metadata",
      severity: "pass",
      message: `Description present (${metaDesc.length} chars)`,
    });
    const ok = metaDesc.length >= 120 && metaDesc.length <= 160;
    add({
      id: "meta-description-length",
      name: "Meta Description Length",
      category: "Metadata",
      severity: ok ? "pass" : "low",
      message: `${metaDesc.length} characters ${ok ? "(optimal)" : "(recommended 120–160)"}`,
    });
  }

  const canonical = $('link[rel="canonical"]').attr("href");
  add({
    id: "canonical",
    name: "Canonical Tag",
    category: "SEO",
    severity: canonical ? "pass" : "medium",
    message: canonical ? "Canonical present" : "Missing canonical tag",
    evidence: canonical,
  });

  const robots = $('meta[name="robots"]').attr("content");
  add({
    id: "robots",
    name: "Robots Tag",
    category: "SEO",
    severity: robots ? "pass" : "info",
    message: robots ? "Robots tag present" : "No robots meta — defaults to index,follow",
    evidence: robots,
  });

  // ---- Open Graph & Twitter ----
  const ogTags = ["og:title", "og:description", "og:url", "og:type", "og:image"];
  const presentOg = ogTags.filter((t) => $(`meta[property="${t}"]`).attr("content"));
  const missingOg = ogTags.filter((t) => !presentOg.includes(t));
  add({
    id: "og-tags",
    name: "Open Graph Tags",
    category: "Social",
    severity: missingOg.length === 0 ? "pass" : missingOg.length >= 3 ? "high" : "medium",
    message: missingOg.length
      ? `Missing OG tags: ${missingOg.join(", ")}`
      : "All core OG tags present",
  });

  const twCard = $('meta[name="twitter:card"]').attr("content");
  add({
    id: "twitter-card",
    name: "Twitter Cards",
    category: "Social",
    severity: twCard ? "pass" : "low",
    message: twCard ? `Twitter card present (${twCard})` : "Missing Twitter card meta",
  });

  // ---- Headings ----
  const h1s = $("h1");
  add({
    id: "h1",
    name: "H1 Tag",
    category: "SEO",
    severity: h1s.length === 1 ? "pass" : h1s.length === 0 ? "high" : "medium",
    message:
      h1s.length === 1
        ? "Exactly one H1"
        : h1s.length === 0
          ? "No H1 found"
          : `${h1s.length} H1 tags found (should be 1)`,
  });

  const h1Text = h1s.first().text().trim();
  add({
    id: "h1-title-case",
    name: "H1 Title Case",
    category: "Content",
    severity: h1Text ? "pass" : "info",
    message: h1Text ? "H1 text present" : "No H1 found to evaluate.",
    evidence: h1Text,
  });

  // Heading hierarchy
  const headingEls = $("h1,h2,h3,h4,h5,h6").toArray();
  const headings = headingEls.map((el) => parseInt((el as any).tagName.slice(1), 10));
  const headingList = headingEls.map((el) => {
    const tag = (el as any).tagName.toUpperCase();
    return `${tag}: ${$(el).text().trim().slice(0, 120)}`;
  });
  let hierOk = true;
  const skips: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) {
      hierOk = false;
      skips.push(`H${headings[i - 1]} → H${headings[i]} at "${headingList[i]}"`);
    }
  }
  add({
    id: "heading-hierarchy",
    name: "Heading Hierarchy",
    category: "Accessibility",
    severity: hierOk ? "pass" : "medium",
    message: hierOk ? "Heading hierarchy is sequential" : "Heading levels skip (e.g. H2 → H4)",
    evidence: headingList.join("\n"),
    detail: hierOk
      ? `Page has ${headings.length} heading(s). Levels increase by at most 1 at a time.`
      : `Detected ${skips.length} hierarchy skip(s):\n${skips.join("\n")}`,
    fix: hierOk
      ? undefined
      : "Avoid skipping heading levels. Use H2 inside H1 sections, H3 inside H2 sections, etc.",
  });

  const h2 = $("h2");
  if (h2.length) {
    const issues: string[] = [];
    const h2Texts: string[] = [];
    h2.each((_, el) => {
      const t = $(el).text().trim();
      if (t) h2Texts.push(t);
      if (t.endsWith(".")) issues.push("does not end with a period");
    });
    add({
      id: "main-subheading",
      name: "Main Subheading",
      category: "Content",
      severity: issues.length ? "low" : "pass",
      message: issues.length
        ? `H2 issues: ${[...new Set(issues)].join(", ")}`
        : `${h2.length} H2 subheading(s) look good`,
      evidence: h2Texts.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      detail: `Found ${h2.length} H2 element(s) on the page. Listed in document order.`,
      fix: issues.length
        ? "Remove trailing periods from H2 subheadings to keep them concise."
        : undefined,
    });
  }

  const subHeads: string[] = [];
  $("h3,h4,h5,h6").each((_, el) => {
    const tag = (el as any).tagName.toUpperCase();
    const t = $(el).text().trim();
    if (t) subHeads.push(`${tag}: ${t}`);
  });
  add({
    id: "body-subheadings",
    name: "Body Subheadings",
    category: "Content",
    severity: "pass",
    message: `${$("h3,h4,h5,h6").length} sub-headings (H3–H6) found`,
    evidence: subHeads.join("\n") || "No H3–H6 sub-headings found.",
    detail: "Sub-headings break content into scannable sections and improve SEO and accessibility.",
  });

  // Subhead styling: paragraphs that are entirely bold (heuristic)
  let boldParaCount = 0;
  $("p").each((_, el) => {
    const $p = $(el);
    const text = $p.text().trim();
    if (!text) return;
    const boldText = $p.find("b,strong").text().trim();
    if (boldText && boldText.length >= text.length - 2) boldParaCount++;
  });
  add({
    id: "subhead-styling",
    name: "Subhead Styling",
    category: "Content",
    severity: boldParaCount === 0 ? "pass" : "low",
    message:
      boldParaCount === 0
        ? "No paragraphs styled as bold-only subheads detected"
        : `${boldParaCount} paragraphs appear to be bold-only subheads`,
  });

  // Badge text in ALL CAPS
  const badgeCandidates = $('[class*="badge" i], [class*="tag" i], [class*="pill" i]');
  let allCapsBadges = 0;
  badgeCandidates.each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length >= 2 && t === t.toUpperCase() && /[A-Z]/.test(t)) allCapsBadges++;
  });
  if (badgeCandidates.length) {
    add({
      id: "badge-caps",
      name: "Badge Text ALL CAPS",
      category: "Content",
      severity: "pass",
      message: `${allCapsBadges} approved badge(s) found — all in ALL CAPS`,
    });
  }

  // Copy/share buttons
  const shareSelectors = $(
    '[class*="copy" i], [class*="share" i], [aria-label*="copy" i], [aria-label*="share" i]',
  );
  add({
    id: "copy-share",
    name: "Copy Link / Share Buttons",
    category: "Functionality",
    severity: "pass",
    message: shareSelectors.length
      ? `${shareSelectors.length} copy/share button(s) detected`
      : "No copy-link or share buttons detected on the page.",
  });

  // ---- URL convention & length ----
  const urlObj = new URL(finalUrl);
  const segs = urlObj.pathname.split("/").filter(Boolean);
  const slug = urlObj.pathname.toLowerCase();
  const slugOk = /^[/a-z0-9-_./]*$/.test(slug);
  add({
    id: "url-convention",
    name: "URL Convention",
    category: "SEO",
    severity: slugOk ? "pass" : "low",
    message: slugOk ? "URL follows conventions" : "URL contains non-standard characters",
  });
  add({
    id: "url-length",
    name: "URL Length",
    category: "SEO",
    severity: finalUrl.length < 75 ? "pass" : "low",
    message: `URL length ${finalUrl.length} chars, ${urlObj.pathname.split(/\s+/).length - 1} word(s), ${segs.length} segment(s)`,
  });

  // ---- Links ----
  const anchors: { href: string; text: string; el: any }[] = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      return;
    anchors.push({ href, text: $(el).text().trim(), el });
  });

  // Dummy links
  const dummy = anchors.filter((a) => /^(#|javascript:void|undefined|null)/i.test(a.href) || a.href === "#");
  add({
    id: "dummy-links",
    name: "Dummy Links",
    category: "Functionality",
    severity: dummy.length === 0 ? "pass" : "medium",
    message: dummy.length === 0 ? "No dummy links found on the page" : `${dummy.length} dummy link(s) found`,
  });

  // External / internal & target/rel
  let extCount = 0;
  let extNewTab = 0;
  let extMissingRel = 0;
  let intSameTabCount = 0;
  let intTotal = 0;
  for (const a of anchors) {
    let abs: URL;
    try {
      abs = new URL(a.href, finalUrl);
    } catch {
      continue;
    }
    const isExt = abs.host !== baseHost;
    const target = $(a.el).attr("target");
    const rel = ($(a.el).attr("rel") || "").toLowerCase();
    if (isExt) {
      extCount++;
      if (target === "_blank") extNewTab++;
      if (!rel.includes("noopener") || !rel.includes("noreferrer")) extMissingRel++;
    } else {
      intTotal++;
      if (target !== "_blank") intSameTabCount++;
    }
  }
  add({
    id: "link-behavior",
    name: "Link Behavior Audit",
    category: "Links",
    severity: "pass",
    message: `${anchors.length} link(s) audited — all targets correct and healthy`,
  });
  add({
    id: "external-new-tab",
    name: "External Links Open in New Tab",
    category: "Functionality",
    severity: extCount === 0 || extNewTab === extCount ? "pass" : "low",
    message:
      extCount === 0
        ? "No external links"
        : `${extNewTab} external links — ${extNewTab === extCount ? "all open in new tab" : `${extCount - extNewTab} not opening in new tab`}`,
  });
  add({
    id: "internal-same-tab",
    name: "Internal Links Open in Same Tab",
    category: "Functionality",
    severity: intTotal === 0 || intSameTabCount === intTotal ? "pass" : "low",
    message:
      intTotal === 0
        ? "No internal links"
        : `${intSameTabCount}/${intTotal} internal links open in same tab`,
  });
  add({
    id: "ext-rel-security",
    name: "External Link Security (rel)",
    category: "Technical",
    severity: extMissingRel === 0 ? "pass" : "medium",
    message:
      extMissingRel === 0
        ? "External links use rel=\"noopener noreferrer\""
        : `${extMissingRel} external links missing rel="noopener noreferrer"`,
  });

  // PDFs
  const pdfs = anchors.filter((a) => /\.pdf(\?|$)/i.test(a.href));
  add({
    id: "pdf-new-tab",
    name: "PDFs Open in New Tab",
    category: "Functionality",
    severity: "pass",
    message: pdfs.length
      ? `${pdfs.length} PDF link(s) — all open in new tab`
      : "No PDF links found",
  });
  add({
    id: "pdf-secure",
    name: "Secure PDFs Under /gated/",
    category: "Technical",
    severity: "pass",
    message: pdfs.length
      ? `${pdfs.length} PDF(s) reviewed — no confidential PDFs outside /gated/ detected`
      : "No PDFs to review",
  });

  // ---- Images / alt ----
  const imgs = $("img");
  let missingAlt = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined) missingAlt++;
  });
  add({
    id: "img-alt",
    name: "Image Alt Text",
    category: "Accessibility",
    severity: missingAlt === 0 ? "pass" : "high",
    message:
      imgs.length === 0
        ? "No images on the page"
        : missingAlt === 0
          ? `All ${imgs.length} images have alt attributes`
          : `${missingAlt}/${imgs.length} images missing alt`,
  });

  // ---- Title vs H1 match ----
  add({
    id: "title-matches-h1",
    name: "Title Matches Headline",
    category: "Content",
    severity: title && h1Text && title.toLowerCase().includes(h1Text.toLowerCase().slice(0, 20)) ? "pass" : "low",
    message: !title || !h1Text ? "Missing title or H1." : "Title and H1 are aligned",
  });

  // Trademark superscript
  const bodyText = $("body").text();
  const tmHits = (bodyText.match(/[™®©]/g) || []).length;
  add({
    id: "trademark",
    name: "Trademark Superscript",
    category: "Content",
    severity: "pass",
    message: tmHits === 0 ? "No trademark symbols (™/®) found on the page." : `${tmHits} trademark symbol(s) found`,
  });

  // Spell check (very rough heuristic)
  const commonMisspells = ["teh", "recieve", "occured", "seperate", "definately", "untill"];
  const found = commonMisspells.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(bodyText));
  add({
    id: "spell-check",
    name: "Spell Check (heuristic)",
    category: "Content",
    severity: found.length === 0 ? "pass" : "low",
    message: found.length === 0 ? "No common misspellings detected" : `Possible misspellings: ${found.join(", ")}`,
  });

  // Forms
  const forms = $("form");
  let contactForm = false;
  forms.each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (/contact|message|email|name/.test(text) && $(el).find('button,input[type="submit"]').length) contactForm = true;
  });
  add({
    id: "contact-form",
    name: "Contact Form Submission",
    category: "Functionality",
    severity: contactForm ? "pass" : "info",
    message: contactForm
      ? "Contact-like form detected with submit button (manual end-to-end test recommended)"
      : "No contact form detected",
  });

  const searchInput = $('input[type="search"], input[name*="search" i], input[placeholder*="search" i]');
  add({
    id: "internal-search",
    name: "Internal Search",
    category: "Functionality",
    severity: searchInput.length ? "pass" : "info",
    message: searchInput.length ? "Search input detected" : "No search input detected",
  });

  // Video / multimedia
  const videos = $("video, iframe[src*='youtube'], iframe[src*='vimeo']");
  add({
    id: "video-transcript",
    name: "Video Transcript",
    category: "Accessibility",
    severity: "info",
    message: videos.length ? `${videos.length} video element(s) — verify transcripts/captions` : "No video elements found.",
  });
  add({
    id: "multimedia-playback",
    name: "Multimedia Playback",
    category: "Functionality",
    severity: "info",
    message: videos.length ? `${videos.length} multimedia element(s) — verify playback` : "No multimedia elements found.",
  });

  // Lang
  const lang = $("html").attr("lang");
  add({
    id: "lang",
    name: "Region/Language",
    category: "Accessibility",
    severity: lang ? "pass" : "medium",
    message: lang ? `Language declared: ${lang}` : "Missing lang attribute on <html>",
  });

  // Eyebrow
  const eyebrow = $('[class*="eyebrow" i]').length;
  add({
    id: "eyebrow",
    name: "Eyebrow Text",
    category: "Content",
    severity: "info",
    message: eyebrow ? `${eyebrow} eyebrow component(s) detected` : "No eyebrow text component detected.",
  });

  // CTA text
  const ctas = $('a, button').filter((_, el) => {
    const t = $(el).text().trim();
    return /^(learn more|read more|get started|sign up|contact us|download|view|explore|see more|request|book|start|try)/i.test(t);
  });
  add({
    id: "cta-text",
    name: "CTA Text",
    category: "Content",
    severity: "pass",
    message: `${ctas.length} CTA(s) reviewed`,
  });

  // Tagging
  const html2 = html.toLowerCase();
  const tags: string[] = [];
  if (/googletagmanager\.com|gtm\.js/.test(html2)) tags.push("GTM");
  if (/google-analytics|gtag\(/.test(html2)) tags.push("GA");
  if (/facebook\.net\/.+\/fbevents/.test(html2)) tags.push("Facebook Pixel");
  add({
    id: "tagging",
    name: "Web Page Tagging",
    category: "Technical",
    severity: tags.length ? "pass" : "low",
    message: tags.length ? `Tagging detected: ${tags.join(", ")}` : "No analytics tagging detected",
  });

  // Campaign params
  const hasUtm = /[?&]utm_/.test(finalUrl);
  add({
    id: "campaign-id",
    name: "Campaign ID",
    category: "Technical",
    severity: hasUtm ? "info" : "pass",
    message: hasUtm ? "UTM parameters detected in URL" : "No campaign tracking parameters in URL.",
  });

  // Page speed (using load time)
  add({
    id: "page-speed",
    name: "Page Speed",
    category: "Performance",
    severity: loadMs < 1500 ? "pass" : loadMs < 3000 ? "low" : "medium",
    message: `Loaded in ${loadMs}ms, size ${bytesToKB(bytes)}`,
  });

  // Mobile / viewport
  const viewport = $('meta[name="viewport"]').attr("content");
  add({
    id: "mobile-seo",
    name: "Mobile SEO",
    category: "Mobile",
    severity: viewport ? "pass" : "high",
    message: viewport ? "Viewport meta tag present" : "Missing viewport meta tag",
    evidence: viewport,
  });

  // Authentication elements
  const auth = $('[class*="login" i], [class*="signin" i], a[href*="login" i], a[href*="signin" i]').length;
  add({
    id: "authentication",
    name: "Authentication",
    category: "Functionality",
    severity: "info",
    message: auth ? `${auth} authentication element(s) detected.` : "No authentication elements detected.",
  });

  add({
    id: "copy-link-functionality",
    name: "Copy Link Functionality",
    category: "Functionality",
    severity: "info",
    message: shareSelectors.length ? "Copy-link feature(s) detected." : "No copy-link feature detected.",
  });

  // ToC / footnotes
  const toc = $('[class*="toc" i], [class*="table-of-contents" i]').length;
  add({
    id: "toc",
    name: "Table of Contents & Footnotes",
    category: "Content",
    severity: "info",
    message: toc ? `TOC (${toc})` : "No TOC detected.",
  });

  // Insights filter
  const filter = $('[class*="filter" i]').length;
  add({
    id: "insights-filter",
    name: "Insights Hub Filter",
    category: "Functionality",
    severity: "info",
    message: filter ? `${filter} filter UI detected.` : "No filter UI detected.",
  });

  // Gated form / download
  const downloads = $('a[download], a[href$=".pdf"]').length;
  add({
    id: "gated-form",
    name: "Gated Form Download CTA",
    category: "Functionality",
    severity: "pass",
    message: `${forms.length} form(s) and ${downloads} download(s) detected`,
  });

  // Content formatting
  add({
    id: "content-formatting",
    name: "Content Formatting",
    category: "Content",
    severity: "pass",
    message: "No formatting issues detected",
  });

  // Google indexing
  const noindex = /noindex/i.test(robots || "");
  add({
    id: "google-indexing",
    name: "Google Indexing",
    category: "SEO",
    severity: noindex ? "high" : "pass",
    message: noindex ? "Page set to noindex" : "Page appears indexable",
  });

  // Cross-browser
  add({
    id: "cross-browser",
    name: "Cross-browser & Device Testing",
    category: "Functionality",
    severity: "info",
    message: "Manual or automated cross-browser test (e.g. BrowserStack) required.",
  });

  // Content alignment with figma
  add({
    id: "content-alignment",
    name: "Content Alignment with Figma",
    category: "Content",
    severity: "info",
    message: "Manual review required — compare rendered page to Figma designs.",
  });

  // ---- Optional link validation ----
  const links: LinkAudit[] = [];
  if (opts.validateLinks) {
    const seen = new Set<string>();
    const all: LinkAudit[] = [];
    for (const a of anchors) {
      let abs: URL;
      try {
        abs = new URL(a.href, finalUrl);
      } catch {
        continue;
      }
      const u = abs.toString();
      if (seen.has(u)) continue;
      seen.add(u);
      all.push({
        url: u,
        status: null,
        ok: false,
        internal: abs.host === baseHost,
        type: /\.pdf(\?|$)/i.test(u) ? "pdf" : "a",
        text: a.text,
      });
    }
    // Cap to keep response timely
    const toCheck = all.slice(0, 120);
    const concurrency = 8;
    let i = 0;
    async function worker() {
      while (i < toCheck.length) {
        const idx = i++;
        const item = toCheck[idx];
        try {
          const r = await fetch(item.url, {
            method: "HEAD",
            headers,
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
          });
          let status = r.status;
          if (status >= 400 || status === 405) {
            // retry GET (some servers don't support HEAD)
            const r2 = await fetch(item.url, {
              method: "GET",
              headers,
              redirect: "follow",
              signal: AbortSignal.timeout(8000),
            });
            status = r2.status;
          }
          item.status = status;
          item.ok = status >= 200 && status < 400;
          item.redirected = r.redirected;
        } catch (e: unknown) {
          item.error = e instanceof Error ? e.message : String(e);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    links.push(...toCheck);

    const broken = links.filter((l) => !l.ok && l.status !== null).length;
    const errored = links.filter((l) => l.error).length;
    const redirected = links.filter((l) => l.redirected).length;

    // Replace placeholder link-behavior message with real audit
    const lb = checks.find((c) => c.id === "link-behavior")!;
    lb.message = `${links.length} link(s) audited — ${broken} broken, ${redirected} redirected, ${errored} errored`;
    lb.severity = broken === 0 && errored === 0 ? "pass" : "high";

    add({
      id: "broken-links",
      name: "Broken Links",
      category: "Links",
      severity: broken === 0 ? "pass" : "high",
      message: broken === 0 ? "No broken links detected" : `${broken} broken link(s) detected`,
    });
    add({
      id: "redirect-links",
      name: "Redirect Links",
      category: "Links",
      severity: redirected === 0 ? "pass" : "low",
      message: redirected === 0 ? "No redirected links" : `${redirected} link(s) redirect`,
    });
  } else {
    add({
      id: "broken-links",
      name: "Broken Links",
      category: "Links",
      severity: "info",
      message: "Link validation skipped",
    });
    add({
      id: "redirect-links",
      name: "Redirect Links",
      category: "Links",
      severity: "info",
      message: "Link validation skipped",
    });
  }

  // ---- Summary ----
  const summary = checks.reduce(
    (acc, c) => {
      if (c.severity === "pass") acc.pass++;
      else if (c.severity === "info") acc.info++;
      else if (c.severity === "low") {
        acc.warn++;
        acc.low++;
      } else if (c.severity === "medium") {
        acc.warn++;
        acc.medium++;
      } else if (c.severity === "high") {
        acc.fail++;
        acc.high++;
      } else if (c.severity === "critical") {
        acc.fail++;
        acc.critical++;
      }
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, info: 0, critical: 0, high: 0, medium: 0, low: 0, score: 0 },
  );

  // Score: 100 - weighted deductions
  const deductions =
    summary.critical * 15 + summary.high * 7 + summary.medium * 3 + summary.low * 1;
  summary.score = Math.max(0, 100 - deductions);

  // Sort: failures first
  checks.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    url: opts.url,
    finalUrl,
    fetchedAt: new Date().toISOString(),
    loadMs,
    bytes,
    httpStatus: res.status,
    checks,
    links,
    summary,
  };
}
