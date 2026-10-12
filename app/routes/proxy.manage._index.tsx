import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { proxyCtx, layout, esc, notice, flash, back, loginRedirect, registryFields, ICON } from "../lib/ui.server";
import { PROXY, VISIBILITY, eventTypeList, parseRegistryForm, uniqueSlug, formatDate, trackerTotals } from "../lib/registry.server";

// Storefront: yourshop.com/apps/registry/manage  - the signed-in customer's registries.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, liquid, settings, customerId, url } = await proxyCtx(request);
  if (!settings.enabled) return liquid(layout(settings, notice("Registries are closed", "Please check back soon.")));
  if (!customerId) throw loginRedirect(`${PROXY}/manage`);

  const mine = await prisma.registry.findMany({
    where: { shop, customerId },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { quantityWanted: true, quantityPurchased: true } } },
  });
  const canCreate = mine.length < settings.maxRegistriesPerUser;

  const list = mine.length
    ? mine
        .map((r) => {
          const t = trackerTotals(r.items);
          return `<div class="gr-card"><div class="gr-row" style="justify-content:space-between;flex-wrap:wrap">
            <div style="flex:1;min-width:240px"><h3>${esc(r.title)}</h3>
              <div class="gr-mute">${esc(r.eventType)}${r.eventDate ? " &middot; " + esc(formatDate(r.eventDate)) : ""} &middot; ${t.items} item${t.items === 1 ? "" : "s"}${r.status === "HIDDEN" ? " &middot; hidden by the store" : ""}</div>
              <div class="gr-mini" style="margin-top:10px;max-width:360px"><i style="width:${t.pct}%"></i></div>
              <div class="gr-qty" style="margin-top:4px">${t.got} of ${t.wanted} gifts received &middot; ${r.views} guest view${r.views === 1 ? "" : "s"}</div></div>
            <div class="gr-row"><a class="gr-btn" href="${PROXY}/manage/${esc(r.id)}">Manage</a>
            <a class="gr-btn alt" href="${PROXY}/r/${esc(r.slug)}">View as guest</a></div></div></div>`;
        })
        .join("")
    : `<div class="gr-card" style="text-align:center;padding:40px 22px"><h2 style="justify-content:center">${ICON.gift} Start your first registry</h2><p class="gr-mute">Create one below, then add the products you'd love to receive.</p></div>`;

  const form = canCreate
    ? `<div class="gr-card"><h2>${ICON.heart} Create a registry</h2><form method="post" action="${PROXY}/manage">
        ${registryFields(settings, {}, eventTypeList(settings), VISIBILITY)}
        <button class="gr-btn" type="submit">Create registry</button></form></div>`
    : `<div class="gr-card gr-mute">You've reached the limit of ${settings.maxRegistriesPerUser} registries.</div>`;

  return liquid(layout(settings, `<div class="gr-wrap"><h1 style="margin-bottom:18px">My registries</h1>${flash(url)}${list}${form}</div>`));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, settings, customerId } = await proxyCtx(request);
  if (!customerId) throw loginRedirect(`${PROXY}/manage`);
  if (!settings.enabled) return back("/manage", "Registries are closed right now.", "err");

  const count = await prisma.registry.count({ where: { shop, customerId } });
  if (count >= settings.maxRegistriesPerUser) return back("/manage", "You've reached the registry limit.", "err");

  const parsed = parseRegistryForm(await request.formData(), settings);
  if ("error" in parsed) return back("/manage", parsed.error, "err");

  const registry = await prisma.registry.create({
    data: { ...parsed.data, shop, customerId, slug: await uniqueSlug(shop, parsed.data.title) },
  });
  return back(`/manage/${registry.id}`, "Registry created! Now add some products.", "ok", "items");
};
