import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import prisma from "../db.server";
import { FONTS, HERO_STYLES, LAYOUTS, PALETTES, parseHex } from "./theme";

/** Storefront path of the app proxy (Online Store -> yourshop.com/apps/registry). Must match shopify.app.toml. */
export const PROXY = "/apps/registry";

export const PRIORITIES: Record<string, string> = {
  MUST_HAVE: "Must have",
  NORMAL: "Would love",
  NICE: "Nice to have",
};
export const PRIORITY_RANK: Record<string, number> = { MUST_HAVE: 0, NORMAL: 1, NICE: 2 };

export { VISIBILITY } from "./shared";

type Admin = { graphql: (q: string, o?: any) => Promise<Response> };

export async function getSettings(shop: string) {
  return prisma.registrySettings.upsert({ where: { shop }, update: {}, create: { shop } });
}

export const eventTypeList = (s: { eventTypes: string }) =>
  s.eventTypes.split(",").map((x) => x.trim()).filter(Boolean);

export const numericId = (gid: string) => gid.split("/").pop() ?? "";

export { money } from "./shared";

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
}

export function daysUntil(d: Date | string | null | undefined) {
  if (!d) return null;
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((new Date(d).getTime() - start) / 864e5);
}

function slugify(s: string) {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) ||
    "registry"
  );
}

export async function uniqueSlug(shop: string, title: string) {
  const base = slugify(title);
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${randomBytes(2).toString("hex")}`;
    if (!(await prisma.registry.findUnique({ where: { shop_slug: { shop, slug } } }))) return slug;
  }
  return `${base}-${randomBytes(5).toString("hex")}`;
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function checkPassword(pw: string, stored: string | null) {
  if (!stored || !pw) return false;
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Validates the create/edit registry form. */
export function parseRegistryForm(
  fd: FormData,
  settings: { eventTypes: string },
  existing?: { password: string | null }
): { error: string } | { data: any } {
  const str = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const title = str("title", 80);
  const ownerName = str("ownerName", 80);
  if (!title || !ownerName) return { error: "Please enter a registry title and the names to show on it." };

  const et = str("eventType", 40);
  const eventType = eventTypeList(settings).includes(et) ? et : "Other";

  const ds = str("eventDate", 10);
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(ds) ? new Date(`${ds}T00:00:00Z`) : null;
  if (eventDate && isNaN(eventDate.getTime())) return { error: "That event date isn't valid." };

  const vis = str("visibility", 20);
  const visibility = ["PUBLIC", "LINK_ONLY", "PASSWORD"].includes(vis) ? vis : "PUBLIC";

  const pw = String(fd.get("password") ?? "");
  let password: string | null = existing?.password ?? null;
  if (visibility === "PASSWORD") {
    if (pw) {
      if (pw.length < 4) return { error: "The password needs at least 4 characters." };
      password = hashPassword(pw);
    } else if (!password) {
      return { error: "Please set a password for this registry." };
    }
  } else {
    password = null;
  }

  return {
    data: {
      title,
      ownerName,
      eventType,
      eventDate,
      visibility,
      password,
      message: str("message", 1000) || null,
      surpriseMode: fd.get("surpriseMode") === "on",
    },
  };
}

/* ---------------- Shopify Admin API helpers ---------------- */

export type VariantInfo = {
  id: string;
  productId: string;
  title: string; // variant title ("" for single-variant products)
  productTitle: string;
  handle: string;
  price: number;
  currency: string;
  image: string | null;
  available: boolean;
  active: boolean;
};

const VARIANTS_Q = `#graphql
  query RegistryVariants($ids: [ID!]!) {
    shop { currencyCode }
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        price
        availableForSale
        image { url(transform: { maxWidth: 400 }) }
        product { id title handle status featuredImage { url(transform: { maxWidth: 400 }) } }
      }
    }
  }`;

export async function variantInfo(admin: Admin, ids: string[]) {
  const out = new Map<string, VariantInfo>();
  if (!ids.length) return out;
  const res = await admin.graphql(VARIANTS_Q, { variables: { ids } });
  const json: any = await res.json();
  const currency = json.data?.shop?.currencyCode ?? "USD";
  for (const n of json.data?.nodes ?? []) {
    if (!n?.id) continue;
    out.set(n.id, {
      id: n.id,
      productId: n.product.id,
      title: n.title === "Default Title" ? "" : n.title,
      productTitle: n.product.title,
      handle: n.product.handle,
      price: parseFloat(n.price) || 0,
      currency,
      image: n.image?.url ?? n.product.featuredImage?.url ?? null,
      available: Boolean(n.availableForSale),
      active: n.product.status === "ACTIVE",
    });
  }
  return out;
}

const SEARCH_Q = `#graphql
  query RegistrySearch($q: String!) {
    shop { currencyCode }
    products(first: 8, query: $q) {
      nodes {
        id
        title
        handle
        featuredImage { url(transform: { maxWidth: 300 }) }
        variants(first: 30) { nodes { id title price availableForSale } }
      }
    }
  }`;

export type ProductHit = {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  currency: string;
  variants: { id: string; title: string; price: number; available: boolean }[];
};

export async function searchProducts(admin: Admin, term: string, byHandle = false): Promise<ProductHit[]> {
  const clean = term.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!clean) return [];
  const q = byHandle ? `status:active handle:${clean.replace(/\s/g, "-")}` : `status:active ${clean}`;
  const res = await admin.graphql(SEARCH_Q, { variables: { q } });
  const json: any = await res.json();
  const currency = json.data?.shop?.currencyCode ?? "USD";
  return (json.data?.products?.nodes ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    image: p.featuredImage?.url ?? null,
    currency,
    variants: p.variants.nodes.map((v: any) => ({
      id: v.id,
      title: v.title === "Default Title" ? "" : v.title,
      price: parseFloat(v.price) || 0,
      available: Boolean(v.availableForSale),
    })),
  }));
}

/** Adds a variant to a registry (or bumps the wanted quantity if it's already there). */
export async function addItemToRegistry(opts: {
  admin: Admin;
  registryId: string;
  maxItems: number;
  variantGid: string;
  qty: number;
  priority: string;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const info = (await variantInfo(opts.admin, [opts.variantGid])).get(opts.variantGid);
  if (!info || !info.active) return { ok: false, error: "That product isn't available right now." };

  const qty = Math.min(Math.max(Math.floor(opts.qty) || 1, 1), 99);
  const priority = PRIORITIES[opts.priority] ? opts.priority : "NORMAL";
  const existing = await prisma.registryItem.findUnique({
    where: { registryId_variantId: { registryId: opts.registryId, variantId: opts.variantGid } },
  });
  if (existing) {
    await prisma.registryItem.update({
      where: { id: existing.id },
      data: { quantityWanted: Math.min(existing.quantityWanted + qty, 99) },
    });
    return { ok: true };
  }
  const count = await prisma.registryItem.count({ where: { registryId: opts.registryId } });
  if (count >= opts.maxItems) return { ok: false, error: `A registry can hold up to ${opts.maxItems} items.` };

  await prisma.registryItem.create({
    data: {
      registryId: opts.registryId,
      productId: info.productId,
      variantId: info.id,
      title: info.productTitle,
      variantTitle: info.title || null,
      handle: info.handle,
      imageUrl: info.image,
      price: info.price,
      currency: info.currency,
      quantityWanted: qty,
      priority,
      note: opts.note.trim().slice(0, 200) || null,
      position: count,
    },
  });
  return { ok: true };
}

/* ---------------- Tracker status ---------------- */

export type ItemStatus = "NEEDED" | "PARTIAL" | "GIFTED";

/** The three states every guest sees on the registry tracker. */
export function itemStatus(it: { quantityWanted: number; quantityPurchased: number }): ItemStatus {
  const needed = Math.max(it.quantityWanted - it.quantityPurchased, 0);
  if (needed === 0) return "GIFTED";
  return it.quantityPurchased > 0 ? "PARTIAL" : "NEEDED";
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  NEEDED: "Still needed",
  PARTIAL: "Partly gifted",
  GIFTED: "Gifted",
};

export function trackerTotals(items: { quantityWanted: number; quantityPurchased: number }[]) {
  const wanted = items.reduce((n, i) => n + i.quantityWanted, 0);
  const got = items.reduce((n, i) => n + Math.min(i.quantityPurchased, i.quantityWanted), 0);
  const counts = { NEEDED: 0, PARTIAL: 0, GIFTED: 0 } as Record<ItemStatus, number>;
  for (const i of items) counts[itemStatus(i)]++;
  return { wanted, got, left: Math.max(wanted - got, 0), pct: wanted ? Math.round((got / wanted) * 100) : 0, counts, items: items.length };
}

/* ---------------- Look & feel form ---------------- */

export function parseTheme(fd: FormData): { error: string } | { data: Record<string, string | null> } {
  const s = (k: string, max = 20) => String(fd.get(k) ?? "").trim().slice(0, max);
  const pal = s("palette");
  const palette = pal === "CUSTOM" || PALETTES[pal] ? pal : "STORE";
  const colorAccent = parseHex(fd.get("colorAccent"));
  const colorSecondary = parseHex(fd.get("colorSecondary"));
  const colorBackground = parseHex(fd.get("colorBackground"));
  if (palette === "CUSTOM" && (!colorAccent || !colorSecondary || !colorBackground))
    return { error: "Custom colours need three valid colours (like #d6457a)." };
  return {
    data: {
      palette,
      colorAccent,
      colorSecondary,
      colorBackground,
      fontStyle: FONTS[s("fontStyle")] ? s("fontStyle") : null,
      heroStyle: HERO_STYLES[s("heroStyle")] ? s("heroStyle") : null,
      layout: LAYOUTS[s("layout")] ? s("layout") : null,
    },
  };
}

/* ---------------- Story & gift wall (storefront details form only) ---------------- */

export function parseExtras(fd: FormData) {
  return {
    story: String(fd.get("story") ?? "").trim().slice(0, 2000) || null,
    showGifterWall: fd.get("showGifterWall") === "on",
  };
}

/* ---------------- Delivery address ---------------- */

/** Countries offered in the address form. Shopify only lets guests ship to places the store's markets cover. */
export const COUNTRIES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia", NZ: "New Zealand", IE: "Ireland",
  DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", BE: "Belgium", AT: "Austria",
  CH: "Switzerland", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", PT: "Portugal", PL: "Poland",
  CZ: "Czechia", GR: "Greece", JP: "Japan", KR: "South Korea", SG: "Singapore", HK: "Hong Kong", IN: "India",
  AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel", ZA: "South Africa", NG: "Nigeria", KE: "Kenya",
  MX: "Mexico", BR: "Brazil", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Peru", PH: "Philippines",
  MY: "Malaysia", TH: "Thailand", ID: "Indonesia", VN: "Vietnam", TR: "Turkey",
};

export function parseShipping(fd: FormData): { error: string } | { data: Record<string, any> } {
  const s = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const shipEnabled = fd.get("shipEnabled") === "on";
  const data = {
    shipEnabled,
    shipShowFull: fd.get("shipShowFull") === "on",
    shipName: s("shipName", 80) || null,
    shipLine1: s("shipLine1", 120) || null,
    shipLine2: s("shipLine2", 120) || null,
    shipCity: s("shipCity", 80) || null,
    shipRegion: s("shipRegion", 80) || null,
    shipPostal: s("shipPostal", 20) || null,
    shipCountry: COUNTRIES[s("shipCountry", 2).toUpperCase()] ? s("shipCountry", 2).toUpperCase() : null,
    shipPhone: s("shipPhone", 30).replace(/[^0-9+()\-\s.]/g, "") || null,
    shipNote: s("shipNote", 200) || null,
  };
  if (shipEnabled && (!data.shipName || !data.shipLine1 || !data.shipCity || !data.shipPostal || !data.shipCountry))
    return { error: "To let guests ship gifts to you, please fill in your name, street address, city, postcode and country." };
  return { data };
}

type Addr = {
  shipEnabled: boolean;
  shipName: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipRegion: string | null;
  shipPostal: string | null;
  shipCountry: string | null;
  shipPhone: string | null;
};

export const hasAddress = (r: Addr) => Boolean(r.shipEnabled && r.shipName && r.shipLine1 && r.shipCity && r.shipPostal && r.shipCountry);

/** What guests see when the owner keeps the street address private. */
export const shipAreaLabel = (r: Addr) =>
  [r.shipCity, r.shipRegion, r.shipCountry ? COUNTRIES[r.shipCountry] ?? r.shipCountry : ""].filter(Boolean).join(", ");

export const shipFullLines = (r: Addr) =>
  [
    r.shipName,
    r.shipLine1,
    r.shipLine2,
    [r.shipCity, r.shipRegion, r.shipPostal].filter(Boolean).join(", "),
    r.shipCountry ? COUNTRIES[r.shipCountry] ?? r.shipCountry : "",
  ].filter(Boolean) as string[];

/**
 * Cart-permalink style prefill: Shopify's checkout reads these query parameters and fills in the
 * shipping address so the guest doesn't have to type it.
 */
export function checkoutPrefillUrl(r: Addr) {
  const [first, ...rest] = (r.shipName ?? "").trim().split(/\s+/);
  const parts: string[] = [];
  const put = (k: string, v: string | null | undefined) =>
    v && parts.push(`${encodeURIComponent(`checkout[shipping_address][${k}]`)}=${encodeURIComponent(v)}`);
  put("first_name", first);
  put("last_name", rest.join(" ") || first);
  put("address1", r.shipLine1);
  put("address2", r.shipLine2);
  put("city", r.shipCity);
  put("province", r.shipRegion);
  put("zip", r.shipPostal);
  put("country", r.shipCountry ? COUNTRIES[r.shipCountry] ?? r.shipCountry : null);
  put("phone", r.shipPhone);
  return `/checkout?${parts.join("&")}`;
}

/* ---------------- Photos ---------------- */

export const IMAGE_KINDS: Record<string, { label: string; max: number }> = {
  COVER: { label: "Cover photo", max: 1 },
  PROFILE: { label: "Profile photo", max: 1 },
  GALLERY: { label: "Gallery photo", max: 8 },
};

export const imageUrl = (id: string) => `${PROXY}/img/${encodeURIComponent(id)}`;

const MAX_DATA_URL = 3_600_000; // characters; roughly a 2.6 MB image once decoded

function sniffMime(b: Buffer): string | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Decodes a data: URL sent by the browser and checks the bytes really are a safe raster image (never SVG). */
export function decodeImageDataUrl(dataUrl: string): { ok: true; mime: string; bytes: Buffer } | { ok: false; error: string } {
  if (!dataUrl || dataUrl.length > MAX_DATA_URL) return { ok: false, error: "That photo is too large. Please choose one under 2.5 MB." };
  const m = /^data:image\/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: "Please upload a JPG, PNG, WebP or GIF photo." };
  const bytes = Buffer.from(m[1].replace(/\s/g, ""), "base64");
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, error: "That file doesn't look like a valid photo." };
  return { ok: true, mime, bytes };
}

export async function saveRegistryImage(opts: {
  shop: string;
  registryId: string;
  kind: string;
  dataUrl: string;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const kind = IMAGE_KINDS[opts.kind] ? opts.kind : null;
  if (!kind) return { ok: false, error: "Unknown photo type." };
  const dec = decodeImageDataUrl(opts.dataUrl);
  if (!dec.ok) return dec;

  const existing = await prisma.registryImage.findMany({
    where: { registryId: opts.registryId },
    select: { id: true, kind: true },
  });
  const sameKind = existing.filter((e) => e.kind === kind);
  if (IMAGE_KINDS[kind].max === 1) {
    if (sameKind.length) await prisma.registryImage.deleteMany({ where: { id: { in: sameKind.map((e) => e.id) } } });
  } else if (sameKind.length >= IMAGE_KINDS[kind].max) {
    return { ok: false, error: `You can add up to ${IMAGE_KINDS[kind].max} gallery photos. Remove one first.` };
  }
  if (existing.length >= 12) return { ok: false, error: "That's the maximum number of photos for one registry." };

  await prisma.registryImage.create({
    data: {
      shop: opts.shop,
      registryId: opts.registryId,
      kind,
      mime: dec.mime,
      size: dec.bytes.length,
      bytes: new Uint8Array(dec.bytes),
      caption: (opts.caption ?? "").trim().slice(0, 120) || null,
      position: sameKind.length,
    },
  });
  return { ok: true };
}

/** Image metadata only. Never select `bytes` in list queries. */
export const IMAGE_META = { id: true, kind: true, caption: true, position: true } as const;

export function pickImages<T extends { id: string; kind: string; caption: string | null; position: number }>(imgs: T[]) {
  const sorted = [...imgs].sort((a, b) => a.position - b.position);
  return {
    cover: sorted.find((i) => i.kind === "COVER") ?? null,
    profile: sorted.find((i) => i.kind === "PROFILE") ?? null,
    gallery: sorted.filter((i) => i.kind === "GALLERY"),
  };
}
