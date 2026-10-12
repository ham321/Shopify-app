import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { proxyCtx, layout, esc, notice, flash, back, loginRedirect, options, registryFields, ICON, stat, barChart } from "../lib/ui.server";
import {
  PROXY, PRIORITIES, VISIBILITY, COUNTRIES, IMAGE_KINDS, IMAGE_META,
  eventTypeList, parseRegistryForm, parseTheme, parseShipping, parseExtras, searchProducts, addItemToRegistry,
  saveRegistryImage, pickImages, imageUrl, itemStatus, trackerTotals, STATUS_LABEL,
  money, formatDate, daysUntil,
} from "../lib/registry.server";
import { registryInsights, SOURCE_LABELS } from "../lib/analytics.server";
import { CORNERS, FONTS, HERO_STYLES, LAYOUTS, PALETTES, resolveTheme } from "../lib/theme";

async function ownRegistry(shop: string, customerId: string | null, id: string | undefined) {
  if (!customerId || !id) return null;
  return prisma.registry.findFirst({ where: { id, shop, customerId } });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop, admin, liquid, settings, customerId, url } = await proxyCtx(request);
  if (!customerId) throw loginRedirect(`${PROXY}/manage/${params.id}`);
  const owned = await ownRegistry(shop, customerId, params.id);
  if (!owned) return liquid(layout(settings, notice("Registry not found", "We couldn't find that registry on your account.", `<a class="gr-btn" href="${PROXY}/manage">My registries</a>`)));

  const registry = await prisma.registry.findUniqueOrThrow({
    where: { id: owned.id },
    include: {
      items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      purchases: { orderBy: { createdAt: "desc" } },
      images: { select: IMAGE_META },
    },
  });
  const insights = await registryInsights(registry.id, 30);
  const tot = trackerTotals(registry.items);
  const { cover, profile, gallery } = pickImages(registry.images);
  const theme = resolveTheme(settings, registry);
  const revealed = !registry.surpriseMode || (registry.eventDate !== null && (daysUntil(registry.eventDate) ?? 1) <= 0);
  const here = `${PROXY}/manage/${esc(registry.id)}`;
  const path = `${PROXY}/r/${esc(registry.slug)}`;
  const itemTitle = new Map(registry.items.map((i) => [i.id, i.title]));

  /* ------------------------------ items ------------------------------ */
  const q = (url.searchParams.get("q") ?? "").trim();
  let hits = "";
  if (q) {
    const found = await searchProducts(admin, q);
    hits = found.length
      ? found
          .map(
            (p) => `<form method="post" action="${here}" class="gr-list-item">
            <input type="hidden" name="intent" value="addItem">
            ${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}
            <div class="gr-grow"><strong>${esc(p.title)}</strong>
              <div class="gr-inline" style="margin-top:8px">
                <select class="gr-input" name="variantId" aria-label="Option">${p.variants
                  .map((v) => `<option value="${esc(v.id)}">${esc(v.title || "Standard")} - ${esc(money(v.price, p.currency))}${v.available ? "" : " (sold out)"}</option>`)
                  .join("")}</select>
                <input class="gr-input" type="number" name="qty" value="1" min="1" max="99" aria-label="How many">
                <select class="gr-input" name="priority" aria-label="Priority">${options(PRIORITIES, "NORMAL")}</select>
              </div>
              <input class="gr-input" style="margin-top:8px" name="note" maxlength="200" placeholder="Note for guests, e.g. we'd love the grey one (optional)">
            </div><button class="gr-btn sm" type="submit">Add to registry</button></form>`
          )
          .join("")
      : `<p class="gr-mute">No products matched &ldquo;${esc(q)}&rdquo;.</p>`;
  }

  const itemRows = registry.items.length
    ? registry.items
        .map((it) => {
          const st = itemStatus(it);
          return `<form method="post" action="${here}" class="gr-list-item">
        <input type="hidden" name="itemId" value="${esc(it.id)}">
        ${it.imageUrl ? `<img src="${esc(it.imageUrl)}" alt="">` : ""}
        <div class="gr-grow"><strong>${esc(it.title)}</strong>${it.variantTitle ? ` <span class="gr-mute">${esc(it.variantTitle)}</span>` : ""}
          <div class="gr-mute">${esc(money(it.price, it.currency))} &middot; ${it.quantityPurchased} of ${it.quantityWanted} received &middot; <span class="gr-badge${st === "GIFTED" ? " done" : ""}">${esc(STATUS_LABEL[st])}</span></div>
          <div class="gr-inline" style="margin-top:8px">
            <input class="gr-input" type="number" name="qty" value="${it.quantityWanted}" min="${Math.max(it.quantityPurchased, 1)}" max="99" aria-label="Quantity wanted">
            <select class="gr-input" name="priority" aria-label="Priority">${options(PRIORITIES, it.priority)}</select>
            <input class="gr-input" name="note" maxlength="200" value="${esc(it.note ?? "")}" placeholder="Note for guests" style="flex:1;min-width:180px">
          </div></div>
        <div class="gr-inline"><button class="gr-btn sm" name="intent" value="updateItem">Save</button>
          <button class="gr-btn sm danger" name="intent" value="removeItem" formnovalidate>Remove</button></div></form>`;
        })
        .join("")
    : `<p class="gr-mute">No items yet. Search for products above to add them.</p>`;

  /* ------------------------------ gifts ------------------------------ */
  const gifts = registry.purchases.length
    ? registry.purchases
        .map((p) =>
          revealed
            ? `<form method="post" action="${here}" class="gr-list-item">
          <input type="hidden" name="intent" value="thank"><input type="hidden" name="purchaseId" value="${esc(p.id)}">
          <div class="gr-grow"><strong>${esc(p.gifterName || "Someone")}</strong> gave ${p.quantity} &times; ${esc(p.itemTitle)}
            <div class="gr-mute">${esc(formatDate(p.createdAt))}${p.shippedToRegistry ? " &middot; shipped to your address" : ""}${p.giftMessage ? ` &middot; &ldquo;${esc(p.giftMessage)}&rdquo;` : ""}</div>
            ${p.thanked ? `<div class="gr-badge done" style="margin-top:6px">Thanked</div>${p.thankYouNote ? `<div class="gr-mute">${esc(p.thankYouNote)}</div>` : ""}` : `<input class="gr-input" style="margin-top:8px" name="note" maxlength="300" placeholder="Thank-you note you sent (optional)">`}</div>
          ${p.thanked ? "" : `<button class="gr-btn sm" type="submit">Mark as thanked</button>`}</form>`
            : `<div class="gr-list-item"><div class="gr-grow">A guest gave ${p.quantity} &times; ${esc(p.itemTitle)}</div></div>`
        )
        .join("")
    : `<p class="gr-mute">Gifts will show up here as guests buy them.</p>`;

  /* ------------------------------ overview: checklist + insights ------------------------------ */
  const steps: [boolean, string, string][] = [
    [registry.items.length > 0, "Add your first products", "items"],
    ...(settings.allowPhotos ? ([[Boolean(cover || profile), "Add a cover or profile photo", "photos"]] as [boolean, string, string][]) : []),
    ...(settings.allowAddress ? ([[registry.shipEnabled, "Add a delivery address so gifts can ship to you", "delivery"]] as [boolean, string, string][]) : []),
    [Boolean(registry.story), "Tell your story", "details"],
    [insights.totals.views > 0 || registry.views > 0, "Share your link with guests", "overview"],
  ];
  const done = steps.filter((s) => s[0]).length;
  const checklist =
    done < steps.length
      ? `<div class="gr-card"><h2>${ICON.check} Finish setting up (${done}/${steps.length})</h2><ul class="gr-steps">${steps
          .map(([ok, label, tab]) => `<li class="${ok ? "ok" : ""}"><span class="gr-dot">${ok ? ICON.check : ""}</span>${ok ? esc(label) : `<a href="#${tab}" data-goto="${tab}">${esc(label)}</a>`}</li>`)
          .join("")}</ul></div>`
      : "";

  const maxSource = Math.max(...insights.sources.map((s) => s[1]), 1);
  const topClicked = [...insights.clicksByItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([id]) => itemTitle.has(id));
  const insightsCard = settings.analyticsEnabled
    ? `<div class="gr-card"><h2>${ICON.chart} Registry insights <span class="gr-mute" style="font-weight:400;font-size:14px">last 30 days</span></h2>
        <div class="gr-stats">${stat("Guest views", insights.totals.views)}${stat("Unique visitors", insights.totals.visitors)}${stat("Gift clicks", insights.totals.giftClicks, "tapped 'Gift this'")}${stat("Gifts bought", insights.totals.giftsBought)}${stat("Times shared", insights.totals.shares)}</div>
        <div style="margin-top:14px"><b style="font-size:14px">Views per day</b>${barChart(insights.views, insights.days)}
        <div class="gr-row gr-mute" style="justify-content:space-between"><span>${esc(insights.days[0])}</span><span>${esc(insights.days[insights.days.length - 1])}</span></div></div>
        <div class="gr-split" style="margin-top:16px">
          <div><b style="font-size:14px">Where guests come from</b><div class="gr-bars" style="margin-top:8px">${insights.sources.length ? insights.sources.map(([k, v]) => `<div><span>${esc(SOURCE_LABELS[k] ?? k)}</span><span class="b"><i style="width:${Math.round((v / maxSource) * 100)}%"></i></span><b>${v}</b></div>`).join("") : '<span class="gr-mute">No visits yet. Share your link!</span>'}</div></div>
          <div><b style="font-size:14px">Most-tapped gifts</b><div class="gr-bars" style="margin-top:8px">${topClicked.length ? topClicked.map(([id, v]) => `<div style="grid-template-columns:1fr 34px"><span>${esc(itemTitle.get(id))}</span><b>${v}</b></div>`).join("") : '<span class="gr-mute">Nothing yet.</span>'}</div></div>
        </div><p class="gr-hint">Your own visits are never counted. Visitors are anonymous.</p></div>`
    : "";

  const trackerCard = `<div class="gr-card"><h2>${ICON.gift} Gift tracker</h2>
      <div class="gr-stats">${stat("Items", tot.items)}${stat("Gifted", tot.counts.GIFTED)}${stat("Partly gifted", tot.counts.PARTIAL)}${stat("Still needed", tot.counts.NEEDED)}${stat("Complete", tot.pct + "%")}</div>
      <div class="gr-seg"><i class="g" style="width:${tot.items ? (tot.counts.GIFTED / tot.items) * 100 : 0}%"></i><i class="p" style="width:${tot.items ? (tot.counts.PARTIAL / tot.items) * 100 : 0}%"></i></div>
      <p class="gr-hint">Guests see this same tracker on your public registry page.</p></div>`;

  const overview = `${checklist}
      <div class="gr-card"><h2>${ICON.share} Share with guests</h2>
        <p class="gr-mute">${registry.views} guest view${registry.views === 1 ? "" : "s"}${registry.visibility === "PASSWORD" ? " &middot; remember to tell guests the password" : ""}</p>
        <div class="gr-row"><a class="gr-btn" href="${path}">View as guest</a>
          <button type="button" class="gr-btn alt" data-copy="${path}" data-label="Copy link">${ICON.link} Copy link</button>
          <a class="gr-btn alt" data-share="mail" data-path="${path}" data-title="${esc(registry.title)}" href="#">${ICON.mail} Email</a>
          <a class="gr-btn alt" data-share="whatsapp" data-path="${path}" data-title="${esc(registry.title)}" href="#" target="_blank" rel="noreferrer">WhatsApp</a>
          <a class="gr-btn alt" data-share="sms" data-path="${path}" data-title="${esc(registry.title)}" href="#">Text</a>
          <a class="gr-btn alt" data-share="facebook" data-path="${path}" data-title="${esc(registry.title)}" href="#" target="_blank" rel="noreferrer">Facebook</a></div></div>
      ${trackerCard}${insightsCard}`;

  const itemsPanel = `<div class="gr-card"><h2>Add products</h2>
        <form method="get" action="${here}" class="gr-row"><input type="hidden" name="tab" value="items">
          <input class="gr-input" name="q" value="${esc(q)}" placeholder="Search the store" aria-label="Search products" required>
          <button class="gr-btn" type="submit">Search</button></form>${hits}
        <p class="gr-hint" style="margin-top:12px">Tip: on any product page, use &ldquo;Add to gift registry&rdquo; to add it straight from there.</p></div>
      <div class="gr-card"><h2>Your items (${registry.items.length})</h2>${itemRows}</div>`;

  const giftsPanel = `<div class="gr-card"><h2>Gifts received (${registry.purchases.length})</h2>${!revealed ? '<p class="gr-mute">Surprise mode is on. Names and messages appear on your event date.</p>' : ""}${gifts}</div>`;

  /* ------------------------------ design ------------------------------ */
  const palettes = Object.entries(PALETTES)
    .map(([k, p]) => `<label><input type="radio" name="palette" value="${k}" data-a="${p.accent}" data-s="${p.secondary}" data-b="${p.bg}"${registry.palette === k ? " checked" : ""}><span class="gr-sw"><i style="background:${p.accent}"></i><i style="background:${p.secondary}"></i><i style="background:${p.bg}"></i><span>${esc(p.label)}</span></span></label>`)
    .join("");
  const designPanel = settings.allowCustomization
    ? `<form class="gr-card" method="post" action="${here}" data-design><input type="hidden" name="intent" value="updateTheme">
        <h2>${ICON.palette} Colours &amp; style</h2><p class="gr-mute">Pick a look &mdash; the page behind this form changes instantly so you can preview it.</p>
        <div class="gr-swatches"><label><input type="radio" name="palette" value="STORE"${registry.palette === "STORE" ? " checked" : ""}><span class="gr-sw"><i style="background:${esc(settings.accentColor)}"></i><i style="background:${esc(settings.secondaryColor)}"></i><i style="background:${esc(settings.backgroundColor)}"></i><span>Store default</span></span></label>${palettes}
          <label><input type="radio" name="palette" value="CUSTOM"${registry.palette === "CUSTOM" ? " checked" : ""}><span class="gr-sw"><i style="background:conic-gradient(red,yellow,lime,aqua,blue,magenta,red)"></i><span>My own colours</span></span></label></div>
        <div class="gr-colors">
          <label>Accent (buttons &amp; highlights)<input type="color" name="colorAccent" value="${theme.accent}"></label>
          <label>Banner colour<input type="color" name="colorSecondary" value="${theme.secondary}"></label>
          <label>Page background<input type="color" name="colorBackground" value="${theme.bg}"></label></div>
        <div class="gr-form-grid" style="margin-top:8px">
          <label>Fonts<select class="gr-input" name="fontStyle"><option value="">Store default</option>${options(Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, v.label])), registry.fontStyle)}</select></label>
          <label>Banner style<select class="gr-input" name="heroStyle"><option value="">Store default</option>${options(HERO_STYLES, registry.heroStyle)}</select></label>
          <label>Item layout<select class="gr-input" name="layout"><option value="">Store default</option>${options(LAYOUTS, registry.layout)}</select></label></div>
        <button class="gr-btn" type="submit">Save design</button></form>`
    : `<div class="gr-card gr-mute">The store has locked the registry design.</div>`;

  /* ------------------------------ photos ------------------------------ */
  const uploadForm = (kind: string, title: string, hint: string, max: number, caption = false) =>
    `<form class="gr-drop" data-upload="${kind}" data-max="${max}" method="post" action="${here}" data-done="${here}?ok=${encodeURIComponent("Photo saved.")}#photos">
      <b>${esc(title)}</b><p class="gr-hint">${esc(hint)}</p>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="${esc(title)}">
      ${caption ? `<input class="gr-input" name="caption" maxlength="120" placeholder="Caption (optional)" style="margin:10px auto 0;max-width:340px">` : ""}
      <div style="margin-top:10px"><button class="gr-btn sm" type="submit">${ICON.camera} Upload</button></div><div class="gr-hint" data-msg role="status"></div></form>`;
  const photoRow = (img: { id: string; kind: string; caption: string | null }, round = false) =>
    `<form class="gr-photo${round ? " round" : ""}" method="post" action="${here}" data-confirm="Remove this photo?"><input type="hidden" name="intent" value="deletePhoto"><input type="hidden" name="imageId" value="${esc(img.id)}">
      <img src="${esc(imageUrl(img.id))}" alt=""><div style="flex:1"><b>${esc(IMAGE_KINDS[img.kind]?.label ?? "Photo")}</b>${img.caption ? `<div class="gr-mute">${esc(img.caption)}</div>` : ""}</div><button class="gr-btn sm danger" type="submit">Remove</button></form>`;
  const photosPanel = settings.allowPhotos
    ? `<div class="gr-card"><h2>${ICON.camera} Photos</h2>
        <p class="gr-mute">Photos make your registry feel personal. They're resized in your browser before uploading.</p>
        <div class="gr-split">
          <div>${uploadForm("COVER", cover ? "Replace cover photo" : "Cover photo", "A wide photo for the top banner. Landscape works best.", 1800)}${cover ? photoRow(cover) : ""}</div>
          <div>${uploadForm("PROFILE", profile ? "Replace profile photo" : "Profile photo", "A round photo of you or the couple.", 600)}${profile ? photoRow(profile, true) : ""}</div></div></div>
      <div class="gr-card"><h2>Gallery (${gallery.length}/${IMAGE_KINDS.GALLERY.max})</h2>
        ${gallery.length < IMAGE_KINDS.GALLERY.max ? uploadForm("GALLERY", "Add a gallery photo", "Shown on your registry page. Click to enlarge.", 1400, true) : '<p class="gr-mute">Gallery is full. Remove a photo to add another.</p>'}
        ${gallery.map((g) => photoRow(g)).join("")}</div>`
    : `<div class="gr-card gr-mute">The store has turned off photo uploads.</div>`;

  /* ------------------------------ delivery ------------------------------ */
  const deliveryPanel = settings.allowAddress
    ? `<form class="gr-card" method="post" action="${here}"><input type="hidden" name="intent" value="updateShipping">
        <h2>${ICON.truck} Delivery address</h2>
        <p class="gr-mute">Guests can choose &ldquo;Send it straight to you&rdquo; when they gift something &mdash; the address is filled in for them at checkout.</p>
        <label class="gr-check"><input type="checkbox" name="shipEnabled"${registry.shipEnabled ? " checked" : ""}> <span>Let guests ship gifts to this address</span></label>
        <div class="gr-form-grid">
          <label>Full name<input class="gr-input" name="shipName" maxlength="80" value="${esc(registry.shipName ?? "")}" autocomplete="name"></label>
          <label>Phone (for the courier)<input class="gr-input" name="shipPhone" maxlength="30" value="${esc(registry.shipPhone ?? "")}" autocomplete="tel"></label>
          <label>Address line 1<input class="gr-input" name="shipLine1" maxlength="120" value="${esc(registry.shipLine1 ?? "")}" autocomplete="address-line1"></label>
          <label>Apartment, suite, etc.<input class="gr-input" name="shipLine2" maxlength="120" value="${esc(registry.shipLine2 ?? "")}" autocomplete="address-line2"></label>
          <label>City<input class="gr-input" name="shipCity" maxlength="80" value="${esc(registry.shipCity ?? "")}" autocomplete="address-level2"></label>
          <label>State / province<input class="gr-input" name="shipRegion" maxlength="80" value="${esc(registry.shipRegion ?? "")}" autocomplete="address-level1"></label>
          <label>Postcode / ZIP<input class="gr-input" name="shipPostal" maxlength="20" value="${esc(registry.shipPostal ?? "")}" autocomplete="postal-code"></label>
          <label>Country<select class="gr-input" name="shipCountry"><option value="">Choose...</option>${options(COUNTRIES, registry.shipCountry)}</select></label></div>
        <label>Delivery note for guests (optional)<input class="gr-input" name="shipNote" maxlength="200" value="${esc(registry.shipNote ?? "")}" placeholder="e.g. Please ship after June 1 - we're moving!"></label>
        <label class="gr-check"><input type="checkbox" name="shipShowFull"${registry.shipShowFull ? " checked" : ""}> <span>Show my full street address on the registry page<br><span class="gr-hint">Off by default: guests only see your name and city. Guests who choose &ldquo;send it straight to you&rdquo; still get it filled in at checkout.</span></span></label>
        <button class="gr-btn" type="submit">Save address</button></form>`
    : `<div class="gr-card gr-mute">The store has turned off delivery addresses.</div>`;

  /* ------------------------------ details ------------------------------ */
  const detailsPanel = `<div class="gr-card"><h2>Registry details</h2>
          <form method="post" action="${here}"><input type="hidden" name="intent" value="update">
            ${registryFields(settings, registry, eventTypeList(settings), VISIBILITY)}
            <label>Our story (optional)<textarea class="gr-input" name="story" rows="5" maxlength="2000" placeholder="How you met, why this day matters, what you're dreaming of...">${esc(registry.story ?? "")}</textarea></label>
            ${settings.showGifterWall ? `<label class="gr-check"><input type="checkbox" name="showGifterWall"${registry.showGifterWall ? " checked" : ""}> <span>Show a public &ldquo;Recent gifts&rdquo; list on my registry (guests can opt out of having their name shown)</span></label>` : ""}
            <button class="gr-btn" type="submit">Save details</button></form></div>
        <div class="gr-card"><h2>Delete registry</h2><p class="gr-mute">This removes the registry, its photos and its history. It can't be undone.</p>
          <form method="post" action="${here}" data-confirm="Delete this registry permanently?">
            <input type="hidden" name="intent" value="delete"><button class="gr-btn danger" type="submit">Delete registry</button></form></div>`;

  const tab = (id: string, label: string, icon: string) => `<button type="button" class="gr-tab" role="tab" data-tab="${id}">${icon}${label}</button>`;
  const html = `<div class="gr-wrap">
        <p><a href="${PROXY}/manage">&larr; My registries</a></p>
        <h1 style="margin-bottom:6px">${esc(registry.title)}</h1><p class="gr-mute">${esc(registry.ownerName)} &middot; ${esc(registry.eventType)}${registry.eventDate ? " &middot; " + esc(formatDate(registry.eventDate)) : ""}</p>
        ${flash(url)}
        ${registry.status === "HIDDEN" ? '<div class="gr-flash err">The store has hidden this registry, so guests can\'t see it. Please contact the store.</div>' : ""}
        <div class="gr-tabs" role="tablist">${tab("overview", "Overview", ICON.chart)}${tab("items", `Items (${registry.items.length})`, ICON.gift)}${tab("gifts", `Gifts (${registry.purchases.length})`, ICON.heart)}${settings.allowCustomization ? tab("design", "Design", ICON.palette) : ""}${settings.allowPhotos ? tab("photos", "Photos", ICON.camera) : ""}${settings.allowAddress ? tab("delivery", "Delivery", ICON.truck) : ""}${tab("details", "Details", ICON.user)}</div>
        <section class="gr-panel" data-panel="overview">${overview}</section>
        <section class="gr-panel" data-panel="items">${itemsPanel}</section>
        <section class="gr-panel" data-panel="gifts">${giftsPanel}</section>
        <section class="gr-panel" data-panel="design">${designPanel}</section>
        <section class="gr-panel" data-panel="photos">${photosPanel}</section>
        <section class="gr-panel" data-panel="delivery">${deliveryPanel}</section>
        <section class="gr-panel" data-panel="details">${detailsPanel}</section>
      </div>`;
  void CORNERS;
  return liquid(layout(settings, html, registry));
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { shop, admin, settings, customerId } = await proxyCtx(request);
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  if (!customerId) {
    if (wantsJson) return Response.json({ ok: false, error: "Please log in again." }, { status: 401 });
    throw loginRedirect(`${PROXY}/manage/${params.id}`);
  }
  const registry = await ownRegistry(shop, customerId, params.id);
  if (!registry) return wantsJson ? Response.json({ ok: false, error: "Registry not found." }, { status: 404 }) : back("/manage", "We couldn't find that registry.", "err");

  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const here = `/manage/${registry.id}`;
  const itemId = String(fd.get("itemId") ?? "");
  const qty = Math.min(Math.max(parseInt(String(fd.get("qty") ?? "1"), 10) || 1, 1), 99);

  switch (intent) {
    case "update": {
      const parsed = parseRegistryForm(fd, settings, registry);
      if ("error" in parsed) return back(here, parsed.error, "err", "details");
      await prisma.registry.update({ where: { id: registry.id }, data: { ...parsed.data, ...parseExtras(fd) } });
      return back(here, "Details saved.", "ok", "details");
    }
    case "updateTheme": {
      if (!settings.allowCustomization) return back(here, "Design changes are turned off by the store.", "err", "design");
      const parsed = parseTheme(fd);
      if ("error" in parsed) return back(here, parsed.error, "err", "design");
      await prisma.registry.update({ where: { id: registry.id }, data: parsed.data });
      return back(here, "Design saved. Take a look at your registry!", "ok", "design");
    }
    case "updateShipping": {
      if (!settings.allowAddress) return back(here, "Delivery addresses are turned off by the store.", "err", "delivery");
      const parsed = parseShipping(fd);
      if ("error" in parsed) return back(here, parsed.error, "err", "delivery");
      await prisma.registry.update({ where: { id: registry.id }, data: parsed.data });
      return back(here, "Delivery address saved.", "ok", "delivery");
    }
    case "uploadPhoto": {
      const json = (b: Record<string, unknown>, status = 200) => Response.json(b, { status });
      if (!settings.allowPhotos) return json({ ok: false, error: "Photo uploads are turned off by the store." }, 403);
      const r = await saveRegistryImage({ shop, registryId: registry.id, kind: String(fd.get("kind") ?? ""), dataUrl: String(fd.get("dataUrl") ?? ""), caption: String(fd.get("caption") ?? "") });
      return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, 400);
    }
    case "deletePhoto": {
      await prisma.registryImage.deleteMany({ where: { id: String(fd.get("imageId") ?? ""), registryId: registry.id } });
      return back(here, "Photo removed.", "ok", "photos");
    }
    case "addItem": {
      const variantGid = String(fd.get("variantId") ?? "");
      if (!variantGid.startsWith("gid://shopify/ProductVariant/")) return back(here, "Pick a product option first.", "err", "items");
      const r = await addItemToRegistry({
        admin, registryId: registry.id, maxItems: settings.maxItemsPerRegistry, variantGid, qty,
        priority: String(fd.get("priority") ?? "NORMAL"), note: String(fd.get("note") ?? ""),
      });
      return r.ok ? back(here, "Added to your registry.", "ok", "items") : back(here, r.error, "err", "items");
    }
    case "updateItem": {
      const item = await prisma.registryItem.findFirst({ where: { id: itemId, registryId: registry.id } });
      if (!item) return back(here, "Item not found.", "err", "items");
      const priority = PRIORITIES[String(fd.get("priority"))] ? String(fd.get("priority")) : item.priority;
      await prisma.registryItem.update({
        where: { id: item.id },
        data: { quantityWanted: Math.max(qty, item.quantityPurchased, 1), priority, note: String(fd.get("note") ?? "").trim().slice(0, 200) || null },
      });
      return back(here, "Item updated.", "ok", "items");
    }
    case "removeItem": {
      await prisma.registryItem.deleteMany({ where: { id: itemId, registryId: registry.id } });
      return back(here, "Item removed.", "ok", "items");
    }
    case "thank": {
      await prisma.purchase.updateMany({
        where: { id: String(fd.get("purchaseId") ?? ""), registryId: registry.id },
        data: { thanked: true, thankYouNote: String(fd.get("note") ?? "").trim().slice(0, 300) || null },
      });
      return back(here, "Marked as thanked.", "ok", "gifts");
    }
    case "delete": {
      await prisma.registry.delete({ where: { id: registry.id } });
      return back("/manage", "Registry deleted.");
    }
  }
  return back(here, "Unknown action.", "err");
};
