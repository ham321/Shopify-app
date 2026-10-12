import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { proxyCtx, layout, esc, notice, ICON, progressRing, stat } from "../lib/ui.server";
import {
  PROXY, PRIORITIES, PRIORITY_RANK, IMAGE_META, STATUS_LABEL,
  numericId, variantInfo, checkPassword, money, formatDate, daysUntil,
  itemStatus, trackerTotals, hasAddress, shipAreaLabel, shipFullLines, pickImages, imageUrl,
} from "../lib/registry.server";

// Storefront: yourshop.com/apps/registry/r/<slug>  - what guests see.
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop, admin, liquid, settings, url, customerId } = await proxyCtx(request);
  const missing = liquid(
    layout(settings, notice("We couldn't find that registry", "It may have been removed, or the link is incomplete.", `<a class="gr-btn" href="${PROXY}">Search registries</a>`))
  );
  if (!settings.enabled) return missing;

  const registry = await prisma.registry.findUnique({
    where: { shop_slug: { shop, slug: params.slug ?? "" } },
    include: {
      items: true,
      images: { select: IMAGE_META },
      purchases: { select: { gifterName: true, quantity: true, itemTitle: true, anonymous: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!registry || registry.status !== "ACTIVE") return missing;

  const isOwner = Boolean(customerId && registry.customerId === customerId);

  if (registry.visibility === "PASSWORD" && !isOwner) {
    const pw = url.searchParams.get("pw") ?? "";
    if (!checkPassword(pw, registry.password)) {
      return liquid(
        layout(
          settings,
          `<div class="gr-wrap"><div class="gr-card" style="max-width:460px;margin:40px auto;text-align:center">
            <h2 style="justify-content:center">${ICON.heart} ${esc(registry.title)}</h2><p class="gr-mute">This registry is password protected.</p>
            ${pw ? '<div class="gr-flash err">That password isn\'t right.</div>' : ""}
            <form method="get" action="${PROXY}/r/${esc(registry.slug)}" style="text-align:left">
              <label>Password<input class="gr-input" type="password" name="pw" required autofocus></label>
              <button class="gr-btn block" type="submit">View registry</button></form></div></div>`,
          registry
        )
      );
    }
  }

  let live: Awaited<ReturnType<typeof variantInfo>> = new Map();
  try {
    live = await variantInfo(admin, registry.items.map((i) => i.variantId));
  } catch {
    /* fall back to the saved snapshot */
  }

  const items = [...registry.items].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || a.position - b.position
  );
  const tot = trackerTotals(items);
  const days = daysUntil(registry.eventDate);
  const countdown = days === null ? "" : days > 0 ? `${days} day${days === 1 ? "" : "s"} to go` : days === 0 ? "It's today!" : "";
  const { cover, profile, gallery } = pickImages(registry.images);
  const addr = hasAddress(registry);
  const firstName = (registry.shipName ?? "").split(/\s+/)[0] || "them";
  const path = `${PROXY}/r/${esc(registry.slug)}`;
  const revealed = !registry.surpriseMode || (registry.eventDate !== null && (daysUntil(registry.eventDate) ?? 1) <= 0);

  /* ------------------------------ item cards ------------------------------ */
  const cards = items
    .map((it, idx) => {
      const lv = live.get(it.variantId);
      const price = lv?.price ?? it.price;
      const cur = lv?.currency ?? it.currency;
      const img = lv?.image ?? it.imageUrl;
      const unavailable = lv ? !(lv.available && lv.active) : false;
      const needed = Math.max(it.quantityWanted - it.quantityPurchased, 0);
      const status = itemStatus(it);
      const link = `/products/${esc(lv?.handle ?? it.handle)}`;
      const pctItem = Math.min(Math.round((it.quantityPurchased / Math.max(it.quantityWanted, 1)) * 100), 100);

      let action: string;
      if (status === "GIFTED") {
        action = `<span class="gr-badge done">${ICON.check} Gift received</span>`;
      } else if (unavailable) {
        action = `<span class="gr-badge">Currently out of stock</span>`;
      } else {
        action = `<details class="gr-give"><summary class="gr-btn block">${ICON.gift} Gift this</summary>
          <form method="post" action="/cart/add" data-gift data-item="${esc(it.id)}">
            <input type="hidden" name="id" value="${esc(numericId(it.variantId))}">
            <input type="hidden" name="properties[Registry]" value="${esc(registry.title)}">
            <input type="hidden" name="properties[_registry_id]" value="${esc(registry.id)}">
            <input type="hidden" name="properties[_registry_item]" value="${esc(it.id)}">
            <input class="gr-input" name="properties[Gift from]" maxlength="60" placeholder="Your name" aria-label="Your name">
            ${settings.allowGiftMessages ? `<input class="gr-input" name="properties[Gift message]" maxlength="200" placeholder="Gift message (optional)" aria-label="Gift message">` : ""}
            <div class="gr-inline"><input class="gr-input" type="number" name="quantity" value="1" min="1" max="${needed}" aria-label="Quantity"><span class="gr-qty">of ${needed} still needed</span></div>
            ${addr ? `<label class="gr-check gr-give-ship"><input type="checkbox" name="properties[_ship_to_registry]" value="1" checked> <span>Send it straight to ${esc(firstName)} &mdash; we'll fill in the delivery address at checkout</span></label>` : ""}
            ${settings.showGifterWall && registry.showGifterWall ? `<label class="gr-check"><input type="checkbox" name="properties[_anon]" value="1"> <span>Keep my name off the public gift list</span></label>` : ""}
            <button class="gr-btn block" type="submit">Add gift to cart</button>
          </form></details>`;
      }

      const counts = settings.showPurchasedCounts
        ? `<div class="gr-mini" aria-hidden="true"><i style="width:${pctItem}%"></i></div><div class="gr-qty">${it.quantityPurchased} of ${it.quantityWanted} gifted${needed ? ` &middot; ${needed} still needed` : ""}</div>`
        : "";

      return `<article class="gr-item${status === "GIFTED" ? " is-gifted" : ""}" data-title="${esc((it.title + " " + (it.variantTitle ?? "")).toLowerCase())}" data-status="${status}" data-priority="${esc(it.priority)}" data-rank="${PRIORITY_RANK[it.priority] ?? 1}" data-pos="${idx}" data-price="${price}">
        <a class="gr-pic" href="${link}" aria-label="${esc(it.title)}">
          ${img ? `<img src="${esc(img)}" alt="${esc(it.title)}" loading="lazy">` : ""}
          ${it.priority === "MUST_HAVE" ? `<span class="gr-tag must">${esc(PRIORITIES.MUST_HAVE)}</span>` : it.priority === "NICE" ? `<span class="gr-tag">${esc(PRIORITIES.NICE)}</span>` : ""}
          <span class="gr-st ${status}">${esc(STATUS_LABEL[status])}</span>
        </a>
        <div class="gr-body">
          <h3><a href="${link}">${esc(it.title)}</a></h3>
          ${it.variantTitle ? `<div class="gr-mute">${esc(it.variantTitle)}</div>` : ""}
          <div class="gr-price">${esc(money(price, cur))}</div>
          ${it.note ? `<p class="gr-note">${esc(it.note)}</p>` : ""}
          ${counts}
          <div class="gr-actions">${action}</div>
        </div></article>`;
    })
    .join("");

  /* ------------------------------ hero ------------------------------ */
  const hero = `<section class="gr-hero${cover ? " has-cover" : ""}"${cover ? ` style="background-image:url(${esc(imageUrl(cover.id))})"` : ""}>
      <div class="gr-hero-in">
        ${profile ? `<img class="gr-avatar" src="${esc(imageUrl(profile.id))}" alt="${esc(registry.ownerName)}">` : ""}
        <div class="gr-hero-txt">
          <div class="gr-meta">
            <span class="gr-pill">${ICON.gift} ${esc(registry.eventType)}</span>
            ${registry.eventDate ? `<span class="gr-pill">${ICON.calendar} ${esc(formatDate(registry.eventDate))}</span>` : ""}
            ${countdown ? `<span class="gr-pill">${esc(countdown)}</span>` : ""}
          </div>
          <h1>${esc(registry.title)}</h1>
          <p class="gr-owner">${esc(registry.ownerName)}</p>
          ${registry.message ? `<p>${esc(registry.message)}</p>` : ""}
        </div>
        ${tot.wanted ? progressRing(tot.pct, "gifted") : ""}
      </div>
      <div class="gr-hero-bar">
        <button class="gr-btn alt sm" type="button" data-copy="${path}" data-label="Copy link">${ICON.link} Copy link</button>
        <a class="gr-btn alt sm" data-share="mail" data-path="${path}" data-title="${esc(registry.title)}" href="#">${ICON.mail} Email</a>
        <a class="gr-btn alt sm" data-share="whatsapp" data-path="${path}" data-title="${esc(registry.title)}" href="#" target="_blank" rel="noreferrer">WhatsApp</a>
        <a class="gr-btn alt sm" data-share="sms" data-path="${path}" data-title="${esc(registry.title)}" href="#">Text</a>
        <a class="gr-btn alt sm" data-share="facebook" data-path="${path}" data-title="${esc(registry.title)}" href="#" target="_blank" rel="noreferrer">Facebook</a>
      </div></section>`;

  /* ------------------------------ tracker ------------------------------ */
  const gifted = tot.counts.GIFTED, partial = tot.counts.PARTIAL, needed = tot.counts.NEEDED;
  const seg = (n: number) => (tot.items ? ((n / tot.items) * 100).toFixed(2) : "0");
  const tracker =
    settings.showTracker && items.length
      ? `<section class="gr-card gr-tracker" aria-label="Registry tracker">
          <h2>${ICON.chart} Registry tracker</h2>
          <div class="gr-stats">
            ${stat("Items on registry", tot.items)}
            ${stat("Gifted", gifted, "all received")}
            ${stat("Partly gifted", partial, "some received")}
            ${stat("Still needed", needed, "nothing yet")}
          </div>
          <div class="gr-seg" role="img" aria-label="${gifted} gifted, ${partial} partly gifted, ${needed} still needed"><i class="g" style="width:${seg(gifted)}%"></i><i class="p" style="width:${seg(partial)}%"></i></div>
          <div class="gr-legend"><span><b style="background:#22c55e"></b>Gifted (${gifted})</span><span><b style="background:#f59e0b"></b>Partly gifted (${partial})</span><span><b style="background:var(--gr-line)"></b>Still needed (${needed})</span><span style="margin-left:auto">${tot.got} of ${tot.wanted} gifts received</span></div>
        </section>`
      : "";

  /* ------------------------------ side cards ------------------------------ */
  const side: string[] = [];
  if (addr) {
    side.push(`<section class="gr-card"><h2>${ICON.truck} Delivery</h2>
      <address class="gr-addr">${registry.shipShowFull ? shipFullLines(registry).map(esc).join("<br>") : `Gifts ship to <b>${esc(registry.shipName)}</b><br><span class="gr-mute">${esc(shipAreaLabel(registry))}</span>`}</address>
      ${registry.shipNote ? `<div class="gr-addr-note">${esc(registry.shipNote)}</div>` : ""}
      <p class="gr-mute" style="margin:10px 0 0">When you gift something, tick &ldquo;Send it straight to ${esc(firstName)}&rdquo; and we'll fill in the delivery address for you at checkout.</p></section>`);
  }
  if (registry.story) side.push(`<section class="gr-card"><h2>${ICON.heart} Our story</h2><p class="gr-story">${esc(registry.story)}</p></section>`);
  if (gallery.length)
    side.push(`<section class="gr-card"><h2>${ICON.camera} Photos</h2><div class="gr-gal">${gallery
      .map((g) => `<button type="button" data-lb="${esc(imageUrl(g.id))}" aria-label="${esc(g.caption || "Open photo")}"><img src="${esc(imageUrl(g.id))}" alt="${esc(g.caption ?? "")}" loading="lazy"></button>`)
      .join("")}</div></section><div class="gr-lb" role="dialog" aria-label="Photo"><img alt=""></div>`);
  if (settings.showGifterWall && registry.showGifterWall && (!isOwner || revealed) && registry.purchases.length)
    side.push(`<section class="gr-card"><h2>${ICON.gift} Recent gifts</h2><ul class="gr-wall">${registry.purchases
      .map((p) => {
        const name = p.anonymous || !p.gifterName ? "A kind guest" : p.gifterName;
        return `<li><span class="gr-av">${p.anonymous || !p.gifterName ? "&#9825;" : esc(name.trim().charAt(0).toUpperCase())}</span><span><b>${esc(name)}</b> gave ${p.quantity} &times; ${esc(p.itemTitle)}</span></li>`;
      })
      .join("")}</ul></section>`);

  const ownerBar = isOwner
    ? `<div class="gr-flash ok">This is how guests see your registry. <a href="${PROXY}/manage/${esc(registry.id)}">Edit your registry</a></div>`
    : "";

  const toolbar = `<div class="gr-toolbar">
      <input class="gr-input" data-filter-search placeholder="Search this registry" aria-label="Search this registry">
      <select class="gr-input" data-sort aria-label="Sort"><option value="priority">Sort: Most wanted</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name A-Z</option></select>
      <span class="gr-view" role="group" aria-label="Layout"><button type="button" data-layout-btn="GRID" class="on" aria-label="Grid view">${ICON.grid}</button><button type="button" data-layout-btn="LIST" aria-label="List view">${ICON.list}</button></span>
    </div>
    <div class="gr-chips" style="margin-bottom:18px">
      <button type="button" class="gr-chip on" data-chip="all">All<small>${tot.items}</small></button>
      <button type="button" class="gr-chip" data-chip="needed">Still needed<small>${needed + partial}</small></button>
      <button type="button" class="gr-chip" data-chip="partial">Partly gifted<small>${partial}</small></button>
      <button type="button" class="gr-chip" data-chip="gifted">Gifted<small>${gifted}</small></button>
      <button type="button" class="gr-chip" data-chip="must">Must have</button>
    </div>`;

  const main = items.length
    ? `${toolbar}<div class="gr-grid" data-items>${cards}</div><p class="gr-mute" data-empty style="display:none;text-align:center;padding:30px 0">Nothing matches that. Try a different search or filter.</p>`
    : `<div class="gr-card" style="text-align:center">Nothing has been added to this registry yet. Check back soon!</div>`;

  return liquid(
    layout(
      settings,
      `<div class="gr-wrap">${ownerBar}${hero}${tracker}
        <div class="gr-cols${side.length ? " has-aside" : ""}"><div>${main}</div>${side.length ? `<aside class="gr-aside">${side.join("")}</aside>` : ""}</div>
        <p class="gr-mute" style="text-align:center;margin-top:36px"><a href="${PROXY}">Find another registry</a></p>
      </div>`,
      registry,
      { slug: registry.slug, view: isOwner ? "" : "1", track: settings.analyticsEnabled && !isOwner ? "1" : "" }
    )
  );
};
