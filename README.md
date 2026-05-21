# BAU Automation — QA Scanner

A self-service web QA scanner built with Next.js. Enter any URL and run a deep scan that audits 40+ checks across SEO, metadata, accessibility, content quality, links, performance, and technical issues.

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Features

- 40+ QA checks (title, meta, OG, headings, alt text, lang, viewport, tagging, indexing, etc.)
- Deep link analysis — validates HTTP status, detects broken links and redirects
- Severity-tagged findings with evidence and suggested fixes
- Export full report as JSON
- Optional Basic Auth credentials for protected/dev URLs

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Cheerio for HTML parsing
