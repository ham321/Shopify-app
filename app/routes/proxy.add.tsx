import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { proxyCtx, layout, esc, notice, flash, back, loginRedirect, options, ICON } from "../lib/ui.server";
import { PROXY, PRIORITIES, searchProducts, addItemToRegistry, money } from "../lib/registry.server";

// Storefront: yourshop.com/apps/registry/add?handle=<product-handle>
// Linked from the "Add to gift registry" button on product pages (theme app block / app embed).
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, admin, liquid, settings, customerId, url } = await proxyCtx(request);
  const handle = (url.searchParams.get("handle") ?? "").trim();
  const variant = (url.searchParams.get("variant") ?? "").replace(/\D/g, "");
  if (!customerId) throw loginRedirect(`${PROXY}/add?handle=${encodeURIComponent(handle)}${variant ? `&variant=${variant}` : ""}`);
  if (!settings.enabled) return liquid(layout(settings, notice("Registries are closed", "Please check back soon.")));

  const [product] = await searchProducts(admin, handle, true);
  const mine = await prisma.registry.findMany({ where: { shop, customerId }, orderBy: { createdAt: "desc" } });

  if (!product) return liquid(layout(settings, notice("Product not found", "That product isn't available to add right now.", `<a class="gr-btn" href="${PROXY}/manage">My registries</a>`)));
  if (!mine.length)
    return liquid(layout(settings, notice("Create a registry first", "You'll need a registry before you can add products to it.", `<a class="gr-btn" href="${PROXY}/manage">Create a registry</a>`)));

  const preselect = `gid://shopify/ProductVariant/${variant}`;
  return liquid(
    layout(
      settings,
      `<div class="gr-wrap" style="max-width:640px"><h1 style="margin-bottom:18px">Add to gift registry</h1>${flash(url)}
        <form class="gr-card" method="post" action="${PROXY}/add">
          <div class="gr-row" style="margin-bottom:14px;flex-wrap:nowrap">${product.image ? `<img src="${esc(product.image)}" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:12px;flex:none">` : ""}<h2 style="margin:0">${esc(product.title)}</h2></div>
          <label>Registry<select class="gr-input" name="registryId">${mine.map((r) => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join("")}</select></label>
          <label>Option<select class="gr-input" name="variantId">${product.variants.map((v) => `<option value="${esc(v.id)}"${v.id === preselect ? " selected" : ""}>${esc(v.title || "Standard")} - ${esc(money(v.price, product.currency))}</option>`).join("")}</select></label>
          <div class="gr-form-grid"><label>How many<input class="gr-input" type="number" name="qty" value="1" min="1" max="99"></label>
          <label>Priority<select class="gr-input" name="priority">${options(PRIORITIES, "NORMAL")}</select></label></div>
          <label>Note for guests (optional)<input class="gr-input" name="note" maxlength="200"></label>
          <button class="gr-btn block" type="submit">${ICON.heart} Add to registry</button></form></div>`
    )
  );
};

/**
 * Handles both the full-page form above and the quick "Add to registry" popup on product pages.
 * The popup sends Accept: application/json and gets a JSON reply, so shoppers never leave the product page.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

  const { shop, admin, settings, customerId } = await proxyCtx(request);
  if (!customerId) return wantsJson ? json({ ok: false, login: true, error: "Please log in to add this to your registry." }, 401) : loginRedirect(`${PROXY}/manage`);

  const fd = await request.formData();
  const fail = (path: string, msg: string) => (wantsJson ? json({ ok: false, error: msg }, 400) : back(path, msg, "err"));

  const registry = await prisma.registry.findFirst({ where: { id: String(fd.get("registryId") ?? ""), shop, customerId } });
  if (!registry) return fail("/manage", "We couldn't find that registry.");
  const variantGid = String(fd.get("variantId") ?? "");
  if (!variantGid.startsWith("gid://shopify/ProductVariant/")) return fail(`/manage/${registry.id}`, "Pick a product option first.");

  const r = await addItemToRegistry({
    admin, registryId: registry.id, maxItems: settings.maxItemsPerRegistry, variantGid,
    qty: parseInt(String(fd.get("qty") ?? "1"), 10), priority: String(fd.get("priority") ?? "NORMAL"), note: String(fd.get("note") ?? ""),
  });
  if (!r.ok) return fail(`/manage/${registry.id}`, r.error);
  return wantsJson
    ? json({ ok: true, message: "Added to your registry!", registryTitle: registry.title, manageUrl: `${PROXY}/manage/${registry.id}#items`, viewUrl: `${PROXY}/r/${registry.slug}` })
    : back(`/manage/${registry.id}`, "Added to your registry.", "ok", "items");
};
