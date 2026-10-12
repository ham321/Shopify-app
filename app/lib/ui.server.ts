import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { PROXY, getSettings } from "./registry.server";
import { resolveTheme, type ThemeRegistry, type ThemeSettings } from "./theme";

/** Escapes user text for HTML *and* neutralises Liquid braces (app proxy output is run through Liquid). */
export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");

/** Verifies the Shopify app-proxy signature and returns everything the storefront routes need. */
export async function proxyCtx(request: Request) {
  const { admin, session, liquid } = await authenticate.public.appProxy(request);
  if (!admin || !session)
    throw liquid(
      `<div style="max-width:560px;margin:60px auto;padding:0 16px;text-align:center"><h2>Gift registry isn't ready yet</h2><p>The app isn't installed on this store yet. Open the app once from the Shopify admin to finish setup.</p></div>`
    );
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id") || null;
  const settings = await getSettings(session.shop);
  return { admin, shop: session.shop, liquid: liquid as (body: string) => Response, customerId, settings, url };
}

export const loginRedirect = (returnTo: string) =>
  redirect(`/account/login?return_url=${encodeURIComponent(returnTo)}`);

export const back = (path: string, msg: string, kind: "ok" | "err" = "ok", hash = "") =>
  redirect(`${PROXY}${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}${hash ? "#" + hash : ""}`);

export function flash(url: URL) {
  const ok = url.searchParams.get("ok");
  const err = url.searchParams.get("err");
  return (ok ? `<div class="gr-flash ok" role="status">${esc(ok)}</div>` : "") + (err ? `<div class="gr-flash err" role="alert">${esc(err)}</div>` : "");
}

export const notice = (title: string, body: string, cta = "") =>
  `<div class="gr-wrap"><div class="gr-empty"><h2>${esc(title)}</h2><p>${esc(body)}</p>${cta}</div></div>`;

export const options = (map: Record<string, string> | string[], selected?: string | null) => {
  const entries = Array.isArray(map) ? map.map((m) => [m, m] as [string, string]) : Object.entries(map);
  return entries
    .map(([k, v]) => `<option value="${esc(k)}"${k === selected ? " selected" : ""}>${esc(v)}</option>`)
    .join("");
};

/* ---------------------------------- icons ---------------------------------- */

const svg = (d: string) =>
  `<svg class="gr-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  truck: svg('<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
  camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  chart: svg('<path d="M18 20V10M12 20V4M6 20v-6"/>'),
  palette: svg('<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4a4.7 4.7 0 0 0 4.6-4.7C22 6.1 17.5 2 12 2z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  mail: svg('<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>'),
  pin: svg('<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
  calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  user: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
};

/* ---------------------------------- components ---------------------------------- */

/** Circular progress used in the registry hero. */
export function progressRing(pct: number, label = "complete") {
  const c = 2 * Math.PI * 42;
  return `<div class="gr-ring" role="img" aria-label="${pct}% ${esc(label)}">
    <svg viewBox="0 0 100 100" width="112" height="112"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="9"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-dasharray="${((pct / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
    <div class="gr-ring-t"><b>${pct}%</b><span>${esc(label)}</span></div></div>`;
}

/** Small server-rendered bar chart (no JS, no libraries). */
export function barChart(values: number[], labels: string[], opts: { color?: string; height?: number } = {}) {
  const h = opts.height ?? 120;
  const w = 600;
  const max = Math.max(...values, 1);
  const bw = w / values.length;
  const bars = values
    .map((v, i) => {
      const bh = v ? Math.max((v / max) * (h - 18), 3) : 1.5;
      return `<rect x="${(i * bw + bw * 0.14).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${opts.color ?? "var(--gr-accent)"}" opacity="${v ? 1 : 0.25}"><title>${esc(labels[i])}: ${v}</title></rect>`;
    })
    .join("");
  return `<svg class="gr-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Bar chart" width="100%" height="${h}">${bars}</svg>`;
}

export const stat = (label: string, value: string | number, hint = "") =>
  `<div class="gr-stat"><div class="gr-stat-v">${esc(value)}</div><div class="gr-stat-l">${esc(label)}</div>${hint ? `<div class="gr-stat-h">${esc(hint)}</div>` : ""}</div>`;

/* ---------------------------------- layout ---------------------------------- */

/** `attrs` become data-* attributes on the wrapper: { slug, track: "1", view: "1" } etc. */
export function layout(settings: ThemeSettings, inner: string, registry?: ThemeRegistry | null, attrs: Record<string, string> = {}) {
  const t = resolveTheme(settings, registry);
  const data = Object.entries(attrs).map(([k, v]) => ` data-${k.replace(/[^a-z-]/gi, "")}="${esc(v)}"`).join("");
  return (
    `{% raw %}${t.fontLink ? `<link rel="stylesheet" href="${t.fontLink}">` : ""}<style>${CSS}${t.customCss}</style>{% endraw %}` +
    `<div class="gr" data-hero="${t.heroStyle}" data-layout="${t.layout}"${data} style="${t.vars}">${inner}</div>` +
    `{% raw %}<script>${JS}</script>{% endraw %}`
  );
}

const CSS = `
.gr{font-family:var(--gr-font);color:var(--gr-ink);background:var(--gr-bg);line-height:1.55;box-sizing:border-box;-webkit-font-smoothing:antialiased;text-align:left}
.gr *,.gr *:before,.gr *:after{box-sizing:inherit}
.gr a{color:var(--gr-accent)}
.gr-wrap{max-width:1140px;margin:0 auto;padding:28px 20px 72px}
.gr h1,.gr h2,.gr h3,.gr h4{font-family:var(--gr-head-font);color:var(--gr-ink);letter-spacing:-.01em;margin:0;line-height:1.15}
.gr h1{font-size:clamp(30px,5vw,50px)}
.gr h2{font-size:22px;margin-bottom:14px}
.gr h3{font-size:17px;margin-bottom:6px;line-height:1.3}
.gr p{margin:0 0 12px}
.gr-mute{color:var(--gr-mute);font-size:14px}
.gr-ic{vertical-align:-3px;flex:none}
.gr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* buttons & inputs */
.gr-btn{display:inline-flex;gap:8px;align-items:center;justify-content:center;background:var(--gr-accent);color:var(--gr-accent-ink)!important;border:1px solid var(--gr-accent);border-radius:var(--gr-btn-radius);padding:10px 18px;font:inherit;font-weight:700;font-size:15px;line-height:1.2;cursor:pointer;text-decoration:none!important;text-align:center;transition:transform .12s,box-shadow .12s,filter .12s}
.gr-btn:hover{filter:brightness(.94);transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.12)}
.gr-btn:focus-visible,.gr-chip:focus-visible,.gr-tab:focus-visible,.gr-input:focus-visible{outline:3px solid var(--gr-accent-line);outline-offset:2px}
.gr-btn.alt{background:var(--gr-surface);color:var(--gr-ink)!important;border-color:var(--gr-line)}
.gr-btn.soft{background:var(--gr-accent-soft);color:var(--gr-accent)!important;border-color:var(--gr-accent-line)}
.gr-btn.danger{background:#b91c1c;border-color:#b91c1c;color:#fff!important}
.gr-btn.sm{padding:6px 12px;font-size:14px}
.gr-btn.block{display:flex;width:100%}
.gr-btn[disabled]{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.gr label{display:block;font-size:14px;font-weight:600;margin-bottom:14px}
.gr-input{display:block;width:100%;margin-top:5px;padding:10px 12px;border:1px solid var(--gr-line);border-radius:var(--gr-btn-radius);font:inherit;font-weight:400;background:var(--gr-surface);color:var(--gr-ink);min-height:42px}
textarea.gr-input{border-radius:min(var(--gr-btn-radius),14px)}
.gr-form-grid{display:grid;gap:0 16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.gr-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.gr-row .gr-input{width:auto;flex:1;min-width:160px;margin:0}
.gr label.gr-check{display:flex;gap:10px;align-items:flex-start;font-weight:500;font-size:14px}
.gr label.gr-check input{width:18px;height:18px;margin:2px 0 0;accent-color:var(--gr-accent);flex:none}
.gr-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gr-inline .gr-input{width:auto;margin:0}
.gr-inline input[type=number]{width:84px}
.gr-hint{font-size:13px;color:var(--gr-mute);font-weight:400;margin-top:4px}

/* cards, flash, empty */
.gr-card{border:1px solid var(--gr-line);border-radius:var(--gr-radius);padding:22px;background:var(--gr-surface);margin-bottom:20px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.gr-card>h2{display:flex;gap:10px;align-items:center}
.gr-flash{padding:12px 16px;border-radius:var(--gr-btn-radius);margin-bottom:16px;font-weight:600}
.gr-flash.ok{background:#dcfce7;color:#14532d}.gr-flash.err{background:#fee2e2;color:#7f1d1d}
.gr-empty{text-align:center;padding:72px 20px}
.gr-badge{display:inline-flex;gap:4px;align-items:center;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;background:var(--gr-soft);color:var(--gr-ink);border:1px solid var(--gr-line)}
.gr-badge.done{background:#dcfce7;border-color:#86efac;color:#166534}

/* hero */
.gr-hero{position:relative;border-radius:calc(var(--gr-radius) + 8px);overflow:hidden;color:var(--gr-hero-ink);margin-bottom:22px;background:linear-gradient(135deg,var(--gr-accent),var(--gr-secondary));box-shadow:0 12px 40px rgba(0,0,0,.14)}
.gr[data-hero=SOLID] .gr-hero{background:var(--gr-secondary)}
.gr-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 85% 15%,rgba(255,255,255,.18),transparent 45%),radial-gradient(circle at 10% 100%,rgba(255,255,255,.1),transparent 40%)}
.gr-hero.has-cover{background-size:cover;background-position:center;color:#fff}
.gr-hero.has-cover:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.12) 0%,rgba(0,0,0,.72) 100%);z-index:0}
.gr-hero-in{position:relative;z-index:1;padding:70px 34px 26px;display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap}
.gr-hero.has-cover .gr-hero-in{padding-top:150px}
.gr-hero h1{color:inherit;text-shadow:0 2px 14px rgba(0,0,0,.18)}
.gr-hero-txt{flex:1;min-width:240px}
.gr-hero-txt p{max-width:62ch;opacity:.95}
.gr-owner{font-size:19px;font-weight:600;margin:8px 0 10px!important}
.gr-avatar{width:128px;height:128px;border-radius:50%;border:5px solid var(--gr-surface);object-fit:cover;background:var(--gr-accent-soft);box-shadow:0 10px 28px rgba(0,0,0,.28);flex:none}
.gr-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.gr-pill{display:inline-flex;gap:6px;align-items:center;background:rgba(255,255,255,.2);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600}
.gr-ring{position:relative;width:112px;height:112px;flex:none;color:#fff}
.gr-ring-t{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.gr-ring-t b{font-size:26px}.gr-ring-t span{font-size:11px;opacity:.9;text-transform:uppercase;letter-spacing:.06em}
.gr-hero-bar{position:relative;z-index:1;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:14px 34px 22px;border-top:1px solid rgba(255,255,255,.18)}
.gr-hero .gr-btn.alt{background:rgba(255,255,255,.16);color:#fff!important;border-color:rgba(255,255,255,.4)}
.gr-hero .gr-btn.alt:hover{background:rgba(255,255,255,.28)}
.gr-hero .gr-mute{color:inherit;opacity:.85}

/* tracker */
.gr-tracker{margin-bottom:22px}
.gr-stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.gr-stat{background:var(--gr-soft);border-radius:var(--gr-radius);padding:14px 16px}
.gr-stat-v{font-size:28px;font-weight:800;line-height:1.1;font-family:var(--gr-head-font)}
.gr-stat-l{font-size:13px;color:var(--gr-mute);font-weight:600}
.gr-stat-h{font-size:12px;color:var(--gr-mute)}
.gr-seg{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--gr-line);margin:16px 0 8px}
.gr-seg i{display:block;height:100%}
.gr-seg .g{background:#22c55e}.gr-seg .p{background:#f59e0b}
.gr-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--gr-mute)}
.gr-legend b{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}

/* two-column page */
.gr-cols{display:grid;gap:26px;grid-template-columns:minmax(0,1fr)}
@media (min-width:980px){.gr-cols.has-aside{grid-template-columns:minmax(0,1fr) 330px}.gr-aside{position:sticky;top:20px;align-self:start}}
.gr-aside .gr-card{padding:18px}
.gr-aside h2{font-size:18px}

/* toolbar */
.gr-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.gr-toolbar .gr-input{margin:0;flex:1;min-width:180px}
.gr-toolbar select.gr-input{flex:none;width:auto;min-width:150px}
.gr-chip{border:1px solid var(--gr-line);background:var(--gr-surface);color:var(--gr-ink);border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.gr-chip small{opacity:.65;margin-left:4px}
.gr-chip.on{background:var(--gr-accent);color:var(--gr-accent-ink);border-color:var(--gr-accent)}
.gr-chips{display:flex;gap:8px;flex-wrap:wrap}
.gr-view{display:inline-flex;border:1px solid var(--gr-line);border-radius:var(--gr-btn-radius);overflow:hidden}
.gr-view button{border:0;background:var(--gr-surface);color:var(--gr-ink);padding:9px 11px;cursor:pointer;line-height:0}
.gr-view button.on{background:var(--gr-accent);color:var(--gr-accent-ink)}

/* items */
.gr-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(235px,1fr))}
.gr-item{position:relative;border:1px solid var(--gr-line);border-radius:var(--gr-radius);overflow:hidden;background:var(--gr-surface);display:flex;flex-direction:column;transition:box-shadow .2s,transform .2s}
.gr-item:hover{box-shadow:0 14px 34px rgba(0,0,0,.1);transform:translateY(-2px)}
.gr-item .gr-pic{position:relative;display:block;aspect-ratio:1/1;background:var(--gr-soft);overflow:hidden}
.gr-item .gr-pic img{width:100%;height:100%;object-fit:cover;transition:transform .35s;display:block}
.gr-item:hover .gr-pic img{transform:scale(1.04)}
.gr-item .gr-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:7px;flex:1}
.gr-item h3 a{color:inherit;text-decoration:none}
.gr-tag{position:absolute;left:10px;top:10px;z-index:1;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;background:#fff;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.gr-tag.must{background:#fef3c7;color:#92400e}
.gr-st{position:absolute;right:10px;top:10px;z-index:1;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.gr-st.NEEDED{background:var(--gr-accent);color:var(--gr-accent-ink)}
.gr-st.PARTIAL{background:#f59e0b;color:#111}
.gr-st.GIFTED{background:#22c55e;color:#fff}
.gr-item.is-gifted .gr-pic img{filter:grayscale(.55) brightness(.95)}
.gr-item.is-gifted{background:var(--gr-soft)}
.gr-price{font-weight:800;font-size:17px}
.gr-note{font-style:italic;color:var(--gr-mute);font-size:14px;margin:0!important;border-left:3px solid var(--gr-accent-line);padding-left:10px}
.gr-mini{height:6px;background:var(--gr-line);border-radius:999px;overflow:hidden}
.gr-mini i{display:block;height:100%;background:var(--gr-accent);border-radius:999px}
.gr-qty{font-size:13px;color:var(--gr-mute);font-weight:600}
.gr-actions{margin-top:auto;padding-top:6px}
details.gr-give>summary{list-style:none;cursor:pointer}
details.gr-give>summary::-webkit-details-marker{display:none}
details.gr-give[open]>summary{background:var(--gr-accent-soft);color:var(--gr-accent)!important;border-color:var(--gr-accent-line)}
.gr-give form{display:grid;gap:8px;margin-top:12px}
.gr-give .gr-input{margin:0}
.gr-give label.gr-check{margin:0;font-size:13px}
.gr-give-ship{background:var(--gr-accent-soft);border-radius:10px;padding:9px 10px}
.gr[data-layout=LIST] .gr-grid{grid-template-columns:1fr;gap:12px}
.gr[data-layout=LIST] .gr-item{flex-direction:row}
.gr[data-layout=LIST] .gr-item .gr-pic{width:150px;aspect-ratio:1/1;flex:none}
.gr[data-layout=LIST] .gr-item .gr-body{padding:12px 16px}
@media (max-width:560px){.gr[data-layout=LIST] .gr-item .gr-pic{width:104px}.gr-hero-in{padding:56px 20px 20px}.gr-hero.has-cover .gr-hero-in{padding-top:110px}.gr-hero-bar{padding:12px 20px 18px}.gr-avatar{width:96px;height:96px}}

/* side cards */
.gr-addr{font-style:normal;line-height:1.6}
.gr-addr-note{background:var(--gr-accent-soft);border-radius:10px;padding:9px 12px;font-size:14px;margin-top:10px}
.gr-story{white-space:pre-line}
.gr-gal{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.gr-gal button{border:0;padding:0;background:var(--gr-soft);border-radius:10px;overflow:hidden;aspect-ratio:1/1;cursor:zoom-in}
.gr-gal img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}
.gr-gal button:hover img{transform:scale(1.06)}
.gr-lb{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:2147483000;display:none;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.gr-lb.on{display:flex}
.gr-lb img{max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.gr-wall{list-style:none;margin:0;padding:0}
.gr-wall li{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--gr-line);font-size:14px}
.gr-wall li:first-child{border-top:0}
.gr-wall .gr-av{width:34px;height:34px;border-radius:50%;background:var(--gr-accent-soft);color:var(--gr-accent);display:flex;align-items:center;justify-content:center;font-weight:800;flex:none}

/* manage area */
.gr-tabs{display:flex;gap:4px;overflow:auto;border-bottom:1px solid var(--gr-line);margin:0 0 22px;padding-bottom:0;-webkit-overflow-scrolling:touch}
.gr-tab{border:0;background:none;color:var(--gr-mute);font:inherit;font-weight:700;padding:11px 16px;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap;display:inline-flex;gap:7px;align-items:center}
.gr-tab.on{color:var(--gr-accent);border-bottom-color:var(--gr-accent)}
.gr.js .gr-panel{display:none}.gr.js .gr-panel.on{display:block}
.gr-list-item{display:flex;gap:14px;padding:14px 0;border-top:1px solid var(--gr-line);align-items:flex-start;flex-wrap:wrap}
.gr-list-item:first-of-type{border-top:0}
.gr-list-item img{width:68px;height:68px;object-fit:cover;border-radius:12px;background:var(--gr-soft)}
.gr-list-item .gr-grow{flex:1;min-width:230px}
.gr-steps{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.gr-steps li{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--gr-soft);font-weight:600;font-size:15px}
.gr-steps li.ok{background:#dcfce7;color:#14532d}
.gr-steps li .gr-dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--gr-line);display:flex;align-items:center;justify-content:center;flex:none;background:var(--gr-surface)}
.gr-steps li.ok .gr-dot{background:#22c55e;border-color:#22c55e;color:#fff}
.gr-chart{display:block;margin:10px 0 4px}
.gr-split{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.gr-bars{display:grid;gap:8px;font-size:14px}
.gr-bars div{display:grid;grid-template-columns:130px 1fr 34px;gap:8px;align-items:center}
.gr-bars span.b{height:8px;border-radius:99px;background:var(--gr-line);overflow:hidden}.gr-bars span.b i{display:block;height:100%;background:var(--gr-accent)}
.gr-swatches{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-bottom:16px}
.gr-swatches label{margin:0;cursor:pointer}
.gr-swatches input{position:absolute;opacity:0;pointer-events:none}
.gr-sw{display:block;border:2px solid var(--gr-line);border-radius:14px;padding:10px;background:var(--gr-surface);transition:border-color .15s,box-shadow .15s}
.gr-swatches input:checked+.gr-sw{border-color:var(--gr-accent);box-shadow:0 0 0 3px var(--gr-accent-soft)}
.gr-swatches input:focus-visible+.gr-sw{outline:3px solid var(--gr-accent-line)}
.gr-sw i{display:inline-block;width:26px;height:26px;border-radius:50%;margin-right:-6px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.gr-sw span{display:block;font-size:13px;font-weight:700;margin-top:8px}
.gr-colors{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.gr-colors input[type=color]{width:100%;height:46px;padding:3px;border:1px solid var(--gr-line);border-radius:10px;background:var(--gr-surface);cursor:pointer;margin-top:5px}
.gr-drop{border:2px dashed var(--gr-accent-line);border-radius:var(--gr-radius);padding:18px;background:var(--gr-accent-soft);text-align:center}
.gr-drop input[type=file]{max-width:100%}
.gr-photo{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--gr-line)}
.gr-photo img{width:88px;height:88px;object-fit:cover;border-radius:12px}
.gr-photo.round img{border-radius:50%}
.gr-pfx{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.gr-find{display:grid;gap:22px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:6px}
.gr-find .gr-card{margin:0;text-align:center;padding:26px 20px}
.gr-find .n{width:38px;height:38px;border-radius:50%;background:var(--gr-accent);color:var(--gr-accent-ink);font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
a.gr-regcard{display:block;text-decoration:none;color:inherit;margin:0;transition:transform .15s,box-shadow .15s}
a.gr-regcard:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.1)}
@media (prefers-reduced-motion:reduce){.gr *{transition:none!important}}
`;

const JS = `
(function(){
  var root=document.querySelector('.gr'); if(!root) return;
  var P='${PROXY}';
  root.classList.add('js');
  var slug=root.getAttribute('data-slug')||'';
  var tracking=root.getAttribute('data-track')==='1' && slug;

  /* ---- anonymous visitor id + analytics beacon ---- */
  var vid=''; try{vid=localStorage.getItem('gr_vid')||''; if(!vid){vid=Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem('gr_vid',vid);}}catch(e){}
  function track(type,extra){
    if(!tracking) return;
    var b=new URLSearchParams(); b.set('slug',slug); b.set('type',type); b.set('visitor',vid);
    for(var k in (extra||{})) b.set(k,extra[k]);
    try{ fetch(P+'/track',{method:'POST',body:b,keepalive:true,credentials:'same-origin'}).catch(function(){}); }catch(e){}
  }
  function channel(){
    var q=new URLSearchParams(location.search).get('src'); if(q) return q;
    var r=document.referrer; if(!r) return 'direct';
    try{ var h=new URL(r).hostname; if(h===location.hostname) return 'direct';
      if(/facebook|instagram|twitter|\\bx\\.com|t\\.co|pinterest|linkedin|tiktok|reddit/.test(h)) return 'social';
      if(/google|bing|duckduckgo|yahoo|ecosia/.test(h)) return 'search'; }catch(e){}
    return 'other';
  }
  if(root.getAttribute('data-view')==='1') track('VIEW',{channel:channel()});

  /* ---- sharing (adds ?src= so you can see which channel brings visitors) ---- */
  function shareUrl(path,src){ var u=location.origin+path; var pw=new URLSearchParams(location.search).get('pw'); var q=['src='+src]; if(pw) q.push('pw='+encodeURIComponent(pw)); return u+(path.indexOf('?')>-1?'&':'?')+q.join('&'); }
  root.querySelectorAll('[data-share]').forEach(function(a){
    var k=a.getAttribute('data-share'), p=a.getAttribute('data-path'), t=a.getAttribute('data-title')||'', u=shareUrl(p,k);
    if(k==='mail') a.href='mailto:?subject='+encodeURIComponent(t)+'&body='+encodeURIComponent(t+' '+u);
    if(k==='whatsapp') a.href='https://wa.me/?text='+encodeURIComponent(t+' '+u);
    if(k==='facebook') a.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(u);
    if(k==='sms') a.href='sms:?&body='+encodeURIComponent(t+' '+u);
    a.addEventListener('click',function(){track('SHARE',{channel:k});});
  });
  root.querySelectorAll('[data-copy]').forEach(function(b){
    b.addEventListener('click',function(){
      var u=shareUrl(b.getAttribute('data-copy'),'copy'), label=b.getAttribute('data-label')||b.textContent;
      var done=function(){b.textContent='Link copied!'; setTimeout(function(){b.textContent=label;},2200); track('SHARE',{channel:'copy'});};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(done,function(){window.prompt('Copy this link',u);});}
      else{window.prompt('Copy this link',u);}
    });
  });
  root.querySelectorAll('form[data-confirm]').forEach(function(f){
    f.addEventListener('submit',function(e){ if(!confirm(f.getAttribute('data-confirm'))) e.preventDefault(); });
  });

  /* ---- guest page: search, filter, sort, layout ---- */
  var grid=root.querySelector('.gr-grid[data-items]');
  if(grid){
    var s=root.querySelector('[data-filter-search]'), chips=root.querySelectorAll('[data-chip]'), sortSel=root.querySelector('[data-sort]'), mode='all';
    var cards=[].slice.call(grid.querySelectorAll('.gr-item'));
    function apply(){
      var q=(s?s.value:'').toLowerCase().trim(), shown=0;
      cards.forEach(function(c){
        var ok=c.getAttribute('data-title').indexOf(q)>-1;
        if(mode==='needed'&&c.getAttribute('data-status')==='GIFTED') ok=false;
        if(mode==='partial'&&c.getAttribute('data-status')!=='PARTIAL') ok=false;
        if(mode==='gifted'&&c.getAttribute('data-status')!=='GIFTED') ok=false;
        if(mode==='must'&&c.getAttribute('data-priority')!=='MUST_HAVE') ok=false;
        c.style.display=ok?'':'none'; if(ok) shown++;
      });
      var e=root.querySelector('[data-empty]'); if(e) e.style.display=shown?'none':'';
    }
    function sortNow(){
      var v=sortSel?sortSel.value:'priority';
      var key={priority:function(c){return +c.getAttribute('data-rank')*1000+ +c.getAttribute('data-pos');},
        low:function(c){return +c.getAttribute('data-price');}, high:function(c){return -c.getAttribute('data-price');},
        name:function(c){return c.getAttribute('data-title');}}[v];
      cards.slice().sort(function(a,b){var x=key(a),y=key(b);return x<y?-1:x>y?1:0;}).forEach(function(c){grid.appendChild(c);});
    }
    if(s) s.addEventListener('input',apply);
    if(sortSel) sortSel.addEventListener('change',sortNow);
    chips.forEach(function(c){c.addEventListener('click',function(){mode=c.getAttribute('data-chip');chips.forEach(function(x){x.classList.toggle('on',x===c);});apply();});});
    root.querySelectorAll('[data-layout-btn]').forEach(function(b){b.addEventListener('click',function(){
      root.setAttribute('data-layout',b.getAttribute('data-layout-btn'));
      root.querySelectorAll('[data-layout-btn]').forEach(function(x){x.classList.toggle('on',x===b);});
      try{localStorage.setItem('gr_layout',b.getAttribute('data-layout-btn'));}catch(e){}
    });});
    try{var sl=localStorage.getItem('gr_layout'); if(sl&&root.querySelector('[data-layout-btn="'+sl+'"]')) root.querySelector('[data-layout-btn="'+sl+'"]').click();}catch(e){}
  }

  /* ---- gifting: optional "ship straight to the registry owner" ---- */
  root.querySelectorAll('form[data-gift]').forEach(function(f){
    f.addEventListener('submit',function(e){
      track('GIFT_CLICK',{itemId:f.getAttribute('data-item')});
      var ship=f.querySelector('[name="properties[_ship_to_registry]"]');
      if(!ship||!ship.checked||!window.fetch) return;
      e.preventDefault();
      var props={}; f.querySelectorAll('[name^="properties["]').forEach(function(el){
        if((el.type==='checkbox'&&!el.checked)||!el.value) return;
        props[el.name.slice(11,-1)]=el.value;
      });
      var btn=f.querySelector('button[type=submit]'); if(btn){btn.disabled=true;btn.textContent='One moment...';}
      fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({items:[{id:Number(f.elements['id'].value),quantity:Number(f.elements['quantity'].value)||1,properties:props}]})})
        .then(function(r){ if(!r.ok) throw new Error('cart'); var pw=new URLSearchParams(location.search).get('pw'); location.href=P+'/ship/'+encodeURIComponent(slug)+(pw?'?pw='+encodeURIComponent(pw):''); })
        .catch(function(){ f.submit(); });
    });
  });

  /* ---- photo lightbox ---- */
  var lb=root.querySelector('.gr-lb');
  if(lb){
    root.querySelectorAll('[data-lb]').forEach(function(b){b.addEventListener('click',function(){lb.querySelector('img').src=b.getAttribute('data-lb');lb.classList.add('on');});});
    lb.addEventListener('click',function(){lb.classList.remove('on');});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')lb.classList.remove('on');});
  }

  /* ---- manage area: tabs ---- */
  var tabs=root.querySelectorAll('[data-tab]'), panels=root.querySelectorAll('[data-panel]');
  if(tabs.length){
    var show=function(id,push){
      var found=false; panels.forEach(function(p){var on=p.getAttribute('data-panel')===id; if(on) found=true;});
      if(!found) id=tabs[0].getAttribute('data-tab');
      panels.forEach(function(p){p.classList.toggle('on',p.getAttribute('data-panel')===id);});
      tabs.forEach(function(t){var on=t.getAttribute('data-tab')===id;t.classList.toggle('on',on);t.setAttribute('aria-selected',on);});
      if(push) history.replaceState(null,'','#'+id);
    };
    tabs.forEach(function(t){t.addEventListener('click',function(){show(t.getAttribute('data-tab'),true);});});
    root.querySelectorAll('[data-goto]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();show(a.getAttribute('data-goto'),true);window.scrollTo({top:root.offsetTop,behavior:'smooth'});});});
    show((location.hash||'').slice(1)||tabs[0].getAttribute('data-tab'));
    window.addEventListener('hashchange',function(){show((location.hash||'').slice(1));});
  }

  /* ---- design tab: live colour preview ---- */
  function hex(h){h=h.replace('#','');return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
  function toHex(a){return '#'+a.map(function(x){x=Math.max(0,Math.min(255,Math.round(x)));return (x<16?'0':'')+x.toString(16);}).join('');}
  function mix(a,b,t){var x=hex(a),y=hex(b);return toHex([x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t]);}
  function lum(h){var c=hex(h).map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
  function ink(h){return lum(h)>0.42?'#111827':'#ffffff';}
  function paint(a,s,b){
    var st=root.style, surface=lum(b)<0.2?mix(b,'#ffffff',0.08):'#ffffff', text=lum(b)<0.2?'#f3f4f6':'#1f2328';
    st.setProperty('--gr-accent',a);st.setProperty('--gr-accent-ink',ink(a));st.setProperty('--gr-accent-soft',mix(a,surface,0.88));st.setProperty('--gr-accent-line',mix(a,surface,0.65));
    st.setProperty('--gr-secondary',s);st.setProperty('--gr-hero-ink',ink(mix(a,s,0.5)));st.setProperty('--gr-bg',b);st.setProperty('--gr-surface',surface);
    st.setProperty('--gr-ink',text);st.setProperty('--gr-mute',mix(text,b,0.42));st.setProperty('--gr-line',mix(text,b,0.86));st.setProperty('--gr-soft',mix(text,b,0.94));
  }
  var design=root.querySelector('[data-design]');
  if(design){
    var ca=design.querySelector('[name=colorAccent]'), cs=design.querySelector('[name=colorSecondary]'), cb=design.querySelector('[name=colorBackground]');
    design.querySelectorAll('[name=palette]').forEach(function(r){r.addEventListener('change',function(){
      if(r.value==='CUSTOM'){paint(ca.value,cs.value,cb.value);}
      else if(r.getAttribute('data-a')){ca.value=r.getAttribute('data-a');cs.value=r.getAttribute('data-s');cb.value=r.getAttribute('data-b');paint(ca.value,cs.value,cb.value);}
    });});
    [ca,cs,cb].forEach(function(i){i.addEventListener('input',function(){var c=design.querySelector('[name=palette][value=CUSTOM]'); if(c) c.checked=true; paint(ca.value,cs.value,cb.value);});});
  }

  /* ---- photo upload: resize in the browser, then post a small data-URL (works reliably through Shopify's app proxy) ---- */
  root.querySelectorAll('form[data-upload]').forEach(function(f){
    var input=f.querySelector('input[type=file]'), msg=f.querySelector('[data-msg]'), max=Number(f.getAttribute('data-max'))||1600;
    var say=function(t,bad){if(msg){msg.textContent=t;msg.style.color=bad?'#b91c1c':'inherit';}};
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var file=input.files&&input.files[0]; if(!file){say('Choose a photo first.',true);return;}
      if(!/^image\\/(jpeg|png|webp|gif)$/.test(file.type)){say('Please choose a JPG, PNG, WebP or GIF photo.',true);return;}
      say('Preparing your photo...');
      var img=new Image(), url=URL.createObjectURL(file);
      img.onload=function(){
        var enc=function(dim,q){var sc=Math.min(1,dim/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q);};
        var d=enc(max,0.84); if(d.length>1100000) d=enc(max*0.8,0.72); if(d.length>1100000) d=enc(max*0.6,0.65);
        URL.revokeObjectURL(url);
        var b=new URLSearchParams(); b.set('intent','uploadPhoto'); b.set('kind',f.getAttribute('data-upload')); b.set('dataUrl',d);
        var cap=f.querySelector('[name=caption]'); if(cap) b.set('caption',cap.value);
        say('Uploading...');
        fetch(f.getAttribute('action'),{method:'POST',body:b,credentials:'same-origin',headers:{Accept:'application/json'}})
          .then(function(r){return r.json();})
          .then(function(j){ if(j&&j.ok){location.href=f.getAttribute('data-done');} else say((j&&j.error)||'Upload failed. Please try a smaller photo.',true); })
          .catch(function(){say('Upload failed. Please check your connection and try again.',true);});
      };
      img.onerror=function(){say('We could not read that photo. Try a different one.',true);};
      img.src=url;
    });
  });
})();
`;

/** Form fields shared by "create registry" and "edit registry". */
export function registryFields(
  s: { eventTypes: string; defaultVisibility: string },
  r: any = {},
  types: string[],
  visibility: Record<string, string>
) {
  return `
  <div class="gr-form-grid">
    <label>Registry title<input class="gr-input" name="title" required maxlength="80" value="${esc(r.title ?? "")}" placeholder="Emma and Jack's wedding"></label>
    <label>Names shown on the registry<input class="gr-input" name="ownerName" required maxlength="80" value="${esc(r.ownerName ?? "")}" placeholder="Emma &amp; Jack"></label>
    <label>Occasion<select class="gr-input" name="eventType">${options(types, r.eventType)}</select></label>
    <label>Event date<input class="gr-input" type="date" name="eventDate" value="${r.eventDate ? new Date(r.eventDate).toISOString().slice(0, 10) : ""}"></label>
    <label>Who can see it<select class="gr-input" name="visibility">${options(visibility, r.visibility ?? s.defaultVisibility)}</select></label>
    <label>Password (only for password-protected)<input class="gr-input" type="text" name="password" maxlength="40" autocomplete="off" placeholder="${r.password ? "Leave blank to keep current" : "At least 4 characters"}"></label>
  </div>
  <label>Message to your guests<textarea class="gr-input" name="message" rows="3" maxlength="1000" placeholder="Thanks for celebrating with us!">${esc(r.message ?? "")}</textarea></label>
  <label class="gr-check"><input type="checkbox" name="surpriseMode"${r.surpriseMode ? " checked" : ""}> <span>Surprise mode: hide who bought what from me until the event date</span></label>`;
}
