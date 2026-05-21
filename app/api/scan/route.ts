import { NextRequest, NextResponse } from "next/server";
import { scanPage } from "@/lib/scanner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    url?: string;
    validateLinks?: boolean;
    username?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const result = await scanPage({
      url,
      validateLinks: body.validateLinks ?? true,
      username: body.username,
      password: body.password,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
