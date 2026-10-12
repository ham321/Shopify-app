import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings } from "../lib/registry.server";
import { VISIBILITY } from "../lib/shared";
import { CORNERS, FONTS, HERO_STYLES, LAYOUTS, PALETTES, normalizeHex, onColor, resolveTheme } from "../lib/theme";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { settings: await getSettings(session.shop) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  const str = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const int = (k: string, min: number, max: number, d: number) =>
    Math.min(Math.max(parseInt(String(fd.get(k) ?? ""), 10) || d, min), max);
  const flag = (k: string) => fd.get(k) === "true";
  const color = (k: string, fallback: string) => normalizeHex(fd.get(k), fallback);
  const pick = (k: string, allowed: Record<string, unknown>, fallback: string) => (str(k, 20) in allowed ? str(k, 20) : fallback);

  const eventTypes = str("eventTypes", 400).split(",").map((t) => t.trim()).filter(Boolean).join(",");
  if (!eventTypes) return { ok: false, error: "Add at least one occasion type." };
  const vis = str("defaultVisibility", 20);

  const data = {
    enabled: flag("enabled"),
    allowGiftMessages: flag("allowGiftMessages"),
    showPurchasedCounts: flag("showPurchasedCounts"),
    showTracker: flag("showTracker"),
    showGifterWall: flag("showGifterWall"),
    allowCustomization: flag("allowCustomization"),
    allowPhotos: flag("allowPhotos"),
    allowAddress: flag("allowAddress"),
    analyticsEnabled: flag("analyticsEnabled"),
    eventTypes,
    defaultVisibility: VISIBILITY[vis] ? vis : "PUBLIC",
    maxItemsPerRegistry: int("maxItemsPerRegistry", 1, 200, 100),
    maxRegistriesPerUser: int("maxRegistriesPerUser", 1, 20, 3),
    welcomeHeading: str("welcomeHeading", 80) || "Gift registry",
    welcomeText: str("welcomeText", 300),
    accentColor: color("accentColor", "#7c3aed"),
    secondaryColor: color("secondaryColor", "#1f2937"),
    backgroundColor: color("backgroundColor", "#ffffff"),
    surfaceColor: color("surfaceColor", "#ffffff"),
    textColor: color("textColor", "#1f2328"),
    fontStyle: pick("fontStyle", FONTS, "THEME"),
    cornerStyle: pick("cornerStyle", CORNERS, "SOFT"),
    heroStyle: pick("heroStyle", HERO_STYLES, "GRADIENT"),
    defaultLayout: pick("defaultLayout", LAYOUTS, "GRID"),
    customCss: str("customCss", 4000).replace(/[<>]/g, ""),
  };
  await prisma.registrySettings.upsert({ where: { shop: session.shop }, update: data, create: { shop: session.shop, ...data } });
  return { ok: true, error: "" };
};

const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;

export default function Settings() {
  const { settings: s } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();

  const [accent, setAccent] = useState(s.accentColor);
  const [secondary, setSecondary] = useState(s.secondaryColor);
  const [bg, setBg] = useState(s.backgroundColor);
  const [surface, setSurface] = useState(s.surfaceColor);
  const [text, setText] = useState(s.textColor);
  const [font, setFont] = useState(s.fontStyle);
  const [corner, setCorner] = useState(s.cornerStyle);

  const t = resolveTheme({ ...s, accentColor: accent, secondaryColor: secondary, backgroundColor: bg, surfaceColor: surface, textColor: text, fontStyle: font, cornerStyle: corner, customCss: "" });
  const vars = Object.fromEntries(t.vars.split(";").map((p) => [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)]));
  const preset = (p: { accent: string; secondary: string; bg: string }) => { setAccent(p.accent); setSecondary(p.secondary); setBg(p.bg); setSurface("#ffffff"); setText("#1f2328"); };

  return (
    <s-page heading="Settings">
      <Form method="post">
        {result?.ok && <s-banner tone="success" heading="Settings saved" />}
        {result && !result.ok && <s-banner tone="critical" heading={result.error} />}

        <s-section heading="Registry program">
          <s-stack gap="base">
            <s-checkbox name="enabled" value="true" label="Registries are open to customers" checked={s.enabled}></s-checkbox>
            <s-checkbox name="allowGiftMessages" value="true" label="Let guests add a gift message" checked={s.allowGiftMessages}></s-checkbox>
            <s-select label="Default visibility" name="defaultVisibility" value={s.defaultVisibility}>
              {Object.entries(VISIBILITY).map(([k, v]) => <s-option key={k} value={k}>{v}</s-option>)}
            </s-select>
            <s-number-field label="Max items per registry (1-200)" name="maxItemsPerRegistry" value={String(s.maxItemsPerRegistry)} min={1} max={200}></s-number-field>
            <s-number-field label="Max registries per customer" name="maxRegistriesPerUser" value={String(s.maxRegistriesPerUser)} min={1} max={20}></s-number-field>
            <s-text-field label="Occasion types (comma separated)" name="eventTypes" value={s.eventTypes}></s-text-field>
          </s-stack>
        </s-section>

        <s-section heading="Features">
          <s-stack gap="base">
            <s-checkbox name="showTracker" value="true" label="Show the registry tracker (gifted / partly gifted / still needed) to guests" checked={s.showTracker}></s-checkbox>
            <s-checkbox name="showPurchasedCounts" value="true" label="Show '2 of 3 gifted' counts on each item" checked={s.showPurchasedCounts}></s-checkbox>
            <s-checkbox name="showGifterWall" value="true" label="Allow a public 'Recent gifts' list (guests can hide their name)" checked={s.showGifterWall}></s-checkbox>
            <s-checkbox name="allowAddress" value="true" label="Let owners add a delivery address so guests can ship gifts straight to them" checked={s.allowAddress}></s-checkbox>
            <s-checkbox name="allowPhotos" value="true" label="Let owners upload a cover photo, profile photo and gallery" checked={s.allowPhotos}></s-checkbox>
            <s-checkbox name="allowCustomization" value="true" label="Let owners customise colours, fonts and layout of their registry" checked={s.allowCustomization}></s-checkbox>
            <s-checkbox name="analyticsEnabled" value="true" label="Collect anonymous registry analytics (views, gift clicks, shares)" checked={s.analyticsEnabled}></s-checkbox>
          </s-stack>
        </s-section>

        <s-section heading="Storefront look (store-wide defaults)">
          <s-stack gap="base">
            <s-stack direction="inline" gap="small">
              {Object.entries(PALETTES).map(([k, p]) => <s-button key={k} onClick={() => preset(p)}>{p.label}</s-button>)}
            </s-stack>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="base">
              <s-color-field label="Accent (buttons)" name="accentColor" value={accent} onInput={(e) => setAccent(val(e))} onChange={(e) => setAccent(val(e))}></s-color-field>
              <s-color-field label="Banner colour" name="secondaryColor" value={secondary} onInput={(e) => setSecondary(val(e))} onChange={(e) => setSecondary(val(e))}></s-color-field>
              <s-color-field label="Page background" name="backgroundColor" value={bg} onInput={(e) => setBg(val(e))} onChange={(e) => setBg(val(e))}></s-color-field>
              <s-color-field label="Card background" name="surfaceColor" value={surface} onInput={(e) => setSurface(val(e))} onChange={(e) => setSurface(val(e))}></s-color-field>
              <s-color-field label="Text colour" name="textColor" value={text} onInput={(e) => setText(val(e))} onChange={(e) => setText(val(e))}></s-color-field>
            </s-grid>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="base">
              <s-select label="Fonts" name="fontStyle" value={font} onChange={(e) => setFont(val(e))}>
                {Object.entries(FONTS).map(([k, v]) => <s-option key={k} value={k}>{v.label}</s-option>)}
              </s-select>
              <s-select label="Corners" name="cornerStyle" value={corner} onChange={(e) => setCorner(val(e))}>
                {Object.entries(CORNERS).map(([k, v]) => <s-option key={k} value={k}>{v.label}</s-option>)}
              </s-select>
              <s-select label="Banner style" name="heroStyle" value={s.heroStyle}>
                {Object.entries(HERO_STYLES).map(([k, v]) => <s-option key={k} value={k}>{v}</s-option>)}
              </s-select>
              <s-select label="Item layout" name="defaultLayout" value={s.defaultLayout}>
                {Object.entries(LAYOUTS).map(([k, v]) => <s-option key={k} value={k}>{v}</s-option>)}
              </s-select>
            </s-grid>

            <div style={{ ...vars, background: vars["--gr-bg"], padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" } as React.CSSProperties}>
              <div style={{ borderRadius: `calc(${vars["--gr-radius"]} + 6px)`, padding: "22px 20px", color: vars["--gr-hero-ink"], background: `linear-gradient(135deg, ${accent}, ${secondary})`, fontFamily: vars["--gr-font"] }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Wedding · June 14</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: vars["--gr-head-font"] }}>Emma &amp; Jack's registry</div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 99, background: "rgba(255,255,255,.3)", maxWidth: 260 }}><div style={{ width: "62%", height: "100%", borderRadius: 99, background: "#fff" }} /></div>
              </div>
              <div style={{ marginTop: 12, padding: 14, background: surface, color: text, borderRadius: vars["--gr-radius"], border: `1px solid ${vars["--gr-line"]}`, fontFamily: vars["--gr-font"] }}>
                <b style={{ fontFamily: vars["--gr-head-font"] }}>Linen duvet cover</b>
                <div style={{ margin: "4px 0 10px", color: vars["--gr-mute"], fontSize: 13 }}>$189.00 · 1 of 2 gifted</div>
                <span style={{ display: "inline-block", background: accent, color: onColor(accent), padding: "9px 16px", borderRadius: vars["--gr-btn-radius"], fontWeight: 700 }}>Gift this</span>
              </div>
            </div>
            <s-text color="subdued">Live preview. Registry owners can still pick their own palette if "customise" is on above.</s-text>

            <s-text-field label="Registry home heading" name="welcomeHeading" value={s.welcomeHeading}></s-text-field>
            <s-text-field label="Registry home text" name="welcomeText" value={s.welcomeText}></s-text-field>
            <s-text-area label="Custom CSS (optional, advanced)" name="customCss" value={s.customCss} rows={4} details="Applied to all registry pages. Target classes such as .gr-btn, .gr-hero, .gr-item."></s-text-area>
          </s-stack>
        </s-section>
        <s-button type="submit" variant="primary">Save settings</s-button>
      </Form>
    </s-page>
  );
}
