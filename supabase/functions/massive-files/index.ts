// massive-files: s3-compatible flat files proxy for files.massive.com
// supports: action="list" (browse prefix), action="download" (fetch & parse csv.gz aggregates)
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const ENDPOINT_HOST = "files.massive.com";
const REGION = "us-east-1";
const SERVICE = "s3";
const BUCKET = "flatfiles";

const ACCESS_KEY = Deno.env.get("MASSIVE_S3_ACCESS_KEY_ID") ?? "";
const SECRET_KEY = Deno.env.get("MASSIVE_S3_SECRET_ACCESS_KEY") ?? "";

// ---------- aws sigv4 ----------
const enc = new TextEncoder();

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uriEncode(str: string, encodeSlash = true): string {
  return str
    .split("")
    .map((ch) => {
      if (/[A-Za-z0-9_\-~.]/.test(ch)) return ch;
      if (ch === "/") return encodeSlash ? "%2F" : "/";
      return encodeURIComponent(ch);
    })
    .join("");
}

async function signedFetch(
  method: "GET" | "HEAD",
  path: string,
  query: Record<string, string> = {},
): Promise<Response> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = "/" + uriEncode(path.replace(/^\/+/, ""), false);
  const sortedKeys = Object.keys(query).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");

  const payloadHash = await sha256Hex("");
  const canonicalHeaders =
    `host:${ENDPOINT_HOST}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(enc.encode("AWS4" + SECRET_KEY), dateStamp);
  const kRegion = await hmac(kDate, REGION);
  const kService = await hmac(kRegion, SERVICE);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${ENDPOINT_HOST}${canonicalUri}${canonicalQuery ? "?" + canonicalQuery : ""}`;
  return await fetch(url, {
    method,
    headers: {
      host: ENDPOINT_HOST,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: authorization,
    },
  });
}

// ---------- xml parsing ----------
function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function extractFirst(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : null;
}

// ---------- gzip + csv ----------
async function decompressGzip(stream: ReadableStream<Uint8Array>): Promise<string> {
  const ds = new DecompressionStream("gzip");
  const decompressed = stream.pipeThrough(ds);
  const text = await new Response(decompressed).text();
  return text;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cols[idx]));
    rows.push(row);
  }
  return rows;
}

// ---------- handlers ----------
async function handleList(prefix: string, maxKeys = 100): Promise<Response> {
  const res = await signedFetch("GET", `/${BUCKET}/`, {
    "list-type": "2",
    prefix,
    "max-keys": String(maxKeys),
  });
  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: `list failed [${res.status}]`, body: await res.text() }),
      { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const xml = await res.text();
  const contents = extractAll(xml, "Contents").map((c) => ({
    key: extractFirst(c, "Key") ?? "",
    size: Number(extractFirst(c, "Size") ?? 0),
    lastModified: extractFirst(c, "LastModified") ?? "",
  }));
  return new Response(
    JSON.stringify({
      prefix,
      truncated: extractFirst(xml, "IsTruncated") === "true",
      count: contents.length,
      items: contents,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleDownload(key: string, symbol?: string): Promise<Response> {
  const res = await signedFetch("GET", `/${BUCKET}/${key}`);
  if (!res.ok || !res.body) {
    return new Response(
      JSON.stringify({ error: `download failed [${res.status}]`, body: await res.text() }),
      { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const csvText = await decompressGzip(res.body);
  let rows = parseCsv(csvText);

  // optional symbol filter (flat-files include all tickers per day)
  if (symbol) {
    const sym = symbol.toUpperCase();
    rows = rows.filter((r) => (r.ticker ?? r.symbol ?? "").toUpperCase() === sym);
  }

  // normalize to twelvedata-like {datetime, open, high, low, close, volume}
  const values = rows.map((r) => {
    const ts = Number(r.window_start ?? r.t ?? 0);
    const dt = ts ? new Date(ts / 1_000_000).toISOString().replace("T", " ").slice(0, 19) : "";
    return {
      datetime: dt,
      open: String(r.open ?? r.o ?? ""),
      high: String(r.high ?? r.h ?? ""),
      low: String(r.low ?? r.l ?? ""),
      close: String(r.close ?? r.c ?? ""),
      volume: String(r.volume ?? r.v ?? ""),
    };
  });

  return new Response(
    JSON.stringify({
      meta: { symbol: symbol ?? "ALL", source: "massive-flatfiles", key },
      values,
      status: "ok",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ACCESS_KEY || !SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: "massive s3 credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const action = body.action ?? url.searchParams.get("action") ?? "list";

    if (action === "list") {
      const prefix = body.prefix ?? url.searchParams.get("prefix") ?? "us_stocks_sip/minute_aggs_v1/";
      const maxKeys = Number(body.maxKeys ?? url.searchParams.get("maxKeys") ?? 100);
      return await handleList(prefix, maxKeys);
    }

    if (action === "download") {
      const key = body.key ?? url.searchParams.get("key");
      const symbol = body.symbol ?? url.searchParams.get("symbol") ?? undefined;
      if (!key) {
        return new Response(
          JSON.stringify({ error: "missing 'key' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return await handleDownload(key, symbol);
    }

    return new Response(
      JSON.stringify({ error: `unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
