/**
 * Theme engine for the storefront registry.
 *
 * Merchants set store-wide defaults (Settings -> Look & feel). If "allowCustomization" is on, each
 * registry owner can pick a palette / fonts / layout for their own registry. This file turns those
 * choices into one block of CSS variables, so every storefront page stays in sync.
 */

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Accepts #abc, #aabbcc or #aabbccdd and returns #aabbcc (lowercase), or the fallback. */
export function normalizeHex(v: unknown, fallback: string): string {
  const s = String(v ?? "").trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return s.slice(0, 7).toLowerCase();
  return fallback;
}

/** Strict version for forms: returns null when the value isn't a colour. */
export function parseHex(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = normalizeHex(s, "");
  return n || null;
}

const rgb = (hex: string): [number, number, number] => {
  const h = normalizeHex(hex, "#000000").slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("");

/** Blend `a` toward `b`. t=0 -> a, t=1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable text colour (white or near-black) for a given background. */
export const onColor = (bg: string) => (luminance(bg) > 0.42 ? "#111827" : "#ffffff");

/* ------------------------------ presets ------------------------------ */

export type Palette = { label: string; accent: string; secondary: string; bg: string };

/** One-click colour schemes registry owners can choose from. STORE means "use the store's own colours". */
export const PALETTES: Record<string, Palette> = {
  ROSE: { label: "Blush rose", accent: "#d6457a", secondary: "#7a1f45", bg: "#fff7f9" },
  SAGE: { label: "Sage garden", accent: "#4f8a6b", secondary: "#1f4337", bg: "#f5faf7" },
  OCEAN: { label: "Ocean breeze", accent: "#0e7490", secondary: "#0b2f4a", bg: "#f2fafc" },
  MIDNIGHT: { label: "Midnight", accent: "#6366f1", secondary: "#0f172a", bg: "#f6f7ff" },
  SUNSET: { label: "Sunset", accent: "#ea580c", secondary: "#7c2d12", bg: "#fff8f1" },
  LAVENDER: { label: "Lavender", accent: "#7c3aed", secondary: "#3b1d7a", bg: "#faf7ff" },
  GOLD: { label: "Champagne", accent: "#b8892b", secondary: "#3a2c12", bg: "#fffcf4" },
  MONO: { label: "Classic mono", accent: "#111827", secondary: "#4b5563", bg: "#ffffff" },
};

export const FONTS: Record<string, { label: string; body: string; head: string; link?: string }> = {
  THEME: { label: "Match my store theme", body: "inherit", head: "inherit" },
  MODERN: {
    label: "Modern sans",
    body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    head: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  },
  CLASSIC: {
    label: "Classic serif",
    body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    head: "Georgia,'Times New Roman',serif",
  },
  ELEGANT: {
    label: "Elegant (Playfair Display)",
    body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    head: "'Playfair Display',Georgia,serif",
    link: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&display=swap",
  },
  FRIENDLY: {
    label: "Friendly rounded (Nunito)",
    body: "'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    head: "'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    link: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&display=swap",
  },
};

export const CORNERS: Record<string, { label: string; card: number; btn: number }> = {
  SHARP: { label: "Sharp", card: 4, btn: 3 },
  SOFT: { label: "Soft", card: 14, btn: 10 },
  ROUND: { label: "Round", card: 24, btn: 999 },
};

export const HERO_STYLES: Record<string, string> = {
  GRADIENT: "Soft gradient",
  SOLID: "Solid colour",
};

export const LAYOUTS: Record<string, string> = {
  GRID: "Grid of cards",
  LIST: "Compact list",
};

/* ------------------------------ resolver ------------------------------ */

export type ThemeSettings = {
  accentColor: string;
  secondaryColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  fontStyle?: string;
  cornerStyle?: string;
  heroStyle?: string;
  defaultLayout?: string;
  customCss?: string;
  allowCustomization?: boolean;
};

export type ThemeRegistry = {
  palette?: string | null;
  colorAccent?: string | null;
  colorSecondary?: string | null;
  colorBackground?: string | null;
  fontStyle?: string | null;
  heroStyle?: string | null;
  layout?: string | null;
};

export type ResolvedTheme = {
  accent: string;
  secondary: string;
  bg: string;
  fontStyle: string;
  heroStyle: string;
  layout: string;
  fontLink: string;
  vars: string;
  customCss: string;
};

export function resolveTheme(s: ThemeSettings, r?: ThemeRegistry | null): ResolvedTheme {
  let accent = normalizeHex(s.accentColor, "#7c3aed");
  let secondary = normalizeHex(s.secondaryColor, "#1f2937");
  let bg = normalizeHex(s.backgroundColor, "#ffffff");
  const surface = normalizeHex(s.surfaceColor, "#ffffff");
  const ink = normalizeHex(s.textColor, "#1f2328");
  let fontStyle = FONTS[s.fontStyle ?? ""] ? (s.fontStyle as string) : "THEME";
  let heroStyle = HERO_STYLES[s.heroStyle ?? ""] ? (s.heroStyle as string) : "GRADIENT";
  let layout = LAYOUTS[s.defaultLayout ?? ""] ? (s.defaultLayout as string) : "GRID";
  const corner = CORNERS[s.cornerStyle ?? ""] ?? CORNERS.SOFT;

  if (r && s.allowCustomization !== false) {
    const pal = r.palette ?? "STORE";
    if (PALETTES[pal]) {
      ({ accent, secondary, bg } = PALETTES[pal]);
    } else if (pal === "CUSTOM") {
      accent = normalizeHex(r.colorAccent, accent);
      secondary = normalizeHex(r.colorSecondary, secondary);
      bg = normalizeHex(r.colorBackground, bg);
    }
    if (r.fontStyle && FONTS[r.fontStyle]) fontStyle = r.fontStyle;
    if (r.heroStyle && HERO_STYLES[r.heroStyle]) heroStyle = r.heroStyle;
    if (r.layout && LAYOUTS[r.layout]) layout = r.layout;
  }

  // When the registry owner picked their own palette, keep text dark/light sensible against its background.
  const text = r && s.allowCustomization !== false && (r.palette ?? "STORE") !== "STORE" ? onColor(bg) === "#ffffff" ? "#f3f4f6" : "#1f2328" : ink;
  const surfaceFinal = r && s.allowCustomization !== false && (r.palette ?? "STORE") !== "STORE" ? (luminance(bg) < 0.2 ? mix(bg, "#ffffff", 0.08) : "#ffffff") : surface;

  const font = FONTS[fontStyle];
  const vars = [
    `--gr-accent:${accent}`,
    `--gr-accent-ink:${onColor(accent)}`,
    `--gr-accent-soft:${mix(accent, surfaceFinal, 0.88)}`,
    `--gr-accent-line:${mix(accent, surfaceFinal, 0.65)}`,
    `--gr-secondary:${secondary}`,
    `--gr-secondary-ink:${onColor(secondary)}`,
    `--gr-hero-ink:${onColor(mix(accent, secondary, 0.5))}`,
    `--gr-bg:${bg}`,
    `--gr-surface:${surfaceFinal}`,
    `--gr-ink:${text}`,
    `--gr-mute:${mix(text, bg, 0.42)}`,
    `--gr-line:${mix(text, bg, 0.86)}`,
    `--gr-soft:${mix(text, bg, 0.94)}`,
    `--gr-radius:${corner.card}px`,
    `--gr-btn-radius:${corner.btn}px`,
    `--gr-font:${font.body}`,
    `--gr-head-font:${font.head}`,
  ].join(";");

  // Merchant CSS is trusted (it's their own store) but can never break out of the <style> tag.
  const customCss = String(s.customCss ?? "").replace(/[<>]/g, "").slice(0, 4000);

  return { accent, secondary, bg, fontStyle, heroStyle, layout, fontLink: font.link ?? "", vars, customCss };
}
