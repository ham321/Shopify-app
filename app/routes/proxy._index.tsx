import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { proxyCtx, layout, esc, notice, ICON } from "../lib/ui.server";
import { PROXY, formatDate, imageUrl } from "../lib/registry.server";

// Storefront: yourshop.com/apps/registry  - find a registry or start your own.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, liquid, settings, url } = await proxyCtx(request);
  if (!settings.enabled) return liquid(layout(settings, notice("Registries are closed", "Gift registries aren't available right now. Please check back soon.")));

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  let results = "";
  if (q) {
    const found = await prisma.registry.findMany({
      where: {
        shop,
        status: "ACTIVE",
        visibility: { in: ["PUBLIC", "PASSWORD"] },
        OR: [{ title: { contains: q } }, { ownerName: { contains: q } }],
      },
      orderBy: { eventDate: "asc" },
      take: 24,
      include: { images: { where: { kind: "PROFILE" }, select: { id: true }, take: 1 } },
    });
    results = found.length
      ? `<div class="gr-grid" style="margin-bottom:28px">${found
          .map(
            (r) => `<a class="gr-card gr-regcard" href="${PROXY}/r/${esc(r.slug)}">
              <div class="gr-row" style="flex-wrap:nowrap;gap:14px">
                ${r.images[0] ? `<img src="${esc(imageUrl(r.images[0].id))}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;flex:none">` : `<span class="gr-av" style="width:64px;height:64px;border-radius:50%;background:var(--gr-accent-soft);color:var(--gr-accent);display:flex;align-items:center;justify-content:center;flex:none">${ICON.heart}</span>`}
                <div><h3 style="margin:0">${esc(r.title)}</h3><p class="gr-mute" style="margin:2px 0 0">${esc(r.ownerName)} &middot; ${esc(r.eventType)}${r.eventDate ? " &middot; " + esc(formatDate(r.eventDate)) : ""}</p>
                ${r.visibility === "PASSWORD" ? '<span class="gr-badge" style="margin-top:6px">Password needed</span>' : ""}</div></div></a>`
          )
          .join("")}</div>`
      : `<div class="gr-card">No registries match &ldquo;${esc(q)}&rdquo;. Check the spelling, or ask the couple or host for their direct link.</div>`;
  }

  return liquid(
    layout(
      settings,
      `<div class="gr-wrap">
        <section class="gr-hero"><div class="gr-hero-in" style="padding-top:64px;padding-bottom:40px">
          <div class="gr-hero-txt"><div class="gr-meta"><span class="gr-pill">${ICON.gift} Gift registry</span></div>
          <h1>${esc(settings.welcomeHeading)}</h1><p style="font-size:18px">${esc(settings.welcomeText)}</p>
          <div class="gr-row" style="margin-top:20px"><a class="gr-btn alt" href="${PROXY}/manage">${ICON.heart} Create or manage my registry</a></div></div>
        </div></section>

        <div class="gr-card"><h2>${ICON.search} Find a registry</h2>
          <form method="get" action="${PROXY}" class="gr-row">
            <input class="gr-input" name="q" value="${esc(q)}" placeholder="Search by name or event" aria-label="Search registries" required>
            <button class="gr-btn" type="submit">Search</button>
          </form></div>
        ${results}

        ${q ? "" : `<div class="gr-find">
          <div class="gr-card"><div class="n">1</div><h3>Create</h3><p class="gr-mute">Start a registry for your wedding, baby, birthday or housewarming. Add photos and pick your colours.</p></div>
          <div class="gr-card"><div class="n">2</div><h3>Add &amp; share</h3><p class="gr-mute">Add favourites from the store, then share your link by email, text or WhatsApp.</p></div>
          <div class="gr-card"><div class="n">3</div><h3>Track every gift</h3><p class="gr-mute">See what's been bought and what's still needed. Gifts can ship straight to your door.</p></div>
        </div>`}
      </div>`
    )
  );
};
