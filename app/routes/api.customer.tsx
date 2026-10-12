import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";
import {
  PRIORITIES,
  VISIBILITY,
  addItemToRegistry,
  eventTypeList,
  getSettings,
  numericId,
  parseRegistryForm,
  searchProducts,
  uniqueSlug,
} from "../lib/registry.server";

/**
 * JSON API used by the Customer Account extension (extensions/registry-account).
 * Every request carries a Shopify-signed session token; the customer id comes from the token,
 * never from the request body, so a shopper can only ever touch their own registries.
 *
 *   GET  /api/customer                 -> { settings, registries }
 *   GET  /api/customer?id=<id>         -> { registry, items }
 *   GET  /api/customer?q=<text>        -> { products }
 *   POST /api/customer  { intent, ... } -> create | update | delete | addItem | updateItem | removeItem
 */

async function ctx(request: Request) {
  const { sessionToken, cors } = await authenticate.public.customerAccount(request);
  const shop = sessionToken.dest.replace(/^https?:\/\//, "");
  const customerId = sessionToken.sub ? numericId(sessionToken.sub) : "";
  if (!customerId) throw cors(Response.json({ error: "Please sign in again." }, { status: 401 }));
  const settings = await getSettings(shop);
  return { shop, customerId, settings, cors };
}

const own = (shop: string, customerId: string, id: unknown) =>
  prisma.registry.findFirst({ where: { id: String(id ?? ""), shop, customerId } });

const shape = (r: any, shop: string) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  ownerName: r.ownerName,
  eventType: r.eventType,
  eventDate: r.eventDate ? new Date(r.eventDate).toISOString().slice(0, 10) : "",
  visibility: r.visibility,
  message: r.message ?? "",
  surpriseMode: r.surpriseMode,
  status: r.status,
  hasPassword: Boolean(r.password),
  itemCount: r._count?.items ?? undefined,
  shareUrl: `https://${shop}/apps/registry/r/${r.slug}`,
});

const toFormData = (b: Record<string, any>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(b)) {
    if (v === true) fd.set(k, "on");
    else if (v !== false && v != null) fd.set(k, String(v));
  }
  return fd;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, customerId, settings, cors } = await ctx(request);
  const url = new URL(request.url);
  const ok = (body: unknown, status = 200) => cors(Response.json(body, { status }));

  const q = url.searchParams.get("q");
  if (q !== null) {
    const { admin } = await unauthenticated.admin(shop);
    return ok({ products: await searchProducts(admin, q) });
  }

  const id = url.searchParams.get("id");
  if (id) {
    const registry = await prisma.registry.findFirst({
      where: { id, shop, customerId },
      include: { items: { orderBy: { position: "asc" } }, _count: { select: { purchases: true } } },
    });
    if (!registry) return ok({ error: "Registry not found." }, 404);
    return ok({
      registry: { ...shape(registry, shop), giftCount: registry._count.purchases },
      items: registry.items.map((i) => ({
        id: i.id,
        title: i.title,
        variantTitle: i.variantTitle,
        imageUrl: i.imageUrl,
        price: i.price,
        currency: i.currency,
        quantityWanted: i.quantityWanted,
        quantityPurchased: i.quantityPurchased,
        priority: i.priority,
        note: i.note ?? "",
      })),
    });
  }

  const mine = await prisma.registry.findMany({
    where: { shop, customerId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return ok({
    settings: {
      enabled: settings.enabled,
      eventTypes: eventTypeList(settings),
      maxRegistries: settings.maxRegistriesPerUser,
      visibility: VISIBILITY,
      priorities: PRIORITIES,
    },
    registries: mine.map((r) => shape(r, shop)),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, customerId, settings, cors } = await ctx(request);
  const ok = (body: unknown = { ok: true }, status = 200) => cors(Response.json(body, { status }));
  const fail = (error: string, status = 400) => ok({ error }, status);

  if (request.method !== "POST") return fail("Method not allowed", 405);
  if (!settings.enabled) return fail("Registries are closed right now.");

  const b = (await request.json().catch(() => ({}))) as Record<string, any>;

  if (b.intent === "create") {
    const count = await prisma.registry.count({ where: { shop, customerId } });
    if (count >= settings.maxRegistriesPerUser) return fail("You've reached the registry limit.");
    const parsed = parseRegistryForm(toFormData(b), settings);
    if ("error" in parsed) return fail(parsed.error);
    const registry = await prisma.registry.create({
      data: { ...parsed.data, shop, customerId, slug: await uniqueSlug(shop, parsed.data.title) },
    });
    return ok({ ok: true, id: registry.id });
  }

  const registry = await own(shop, customerId, b.registryId);
  if (!registry) return fail("We couldn't find that registry.", 404);

  switch (b.intent) {
    case "update": {
      const parsed = parseRegistryForm(toFormData(b), settings, registry);
      if ("error" in parsed) return fail(parsed.error);
      await prisma.registry.update({ where: { id: registry.id }, data: parsed.data });
      return ok();
    }
    case "delete":
      await prisma.registry.delete({ where: { id: registry.id } });
      return ok();
    case "addItem": {
      const variantGid = String(b.variantId ?? "");
      if (!variantGid.startsWith("gid://shopify/ProductVariant/")) return fail("Pick a product option first.");
      const { admin } = await unauthenticated.admin(shop);
      const r = await addItemToRegistry({
        admin,
        registryId: registry.id,
        maxItems: settings.maxItemsPerRegistry,
        variantGid,
        qty: Number(b.qty) || 1,
        priority: String(b.priority ?? "NORMAL"),
        note: String(b.note ?? ""),
      });
      return r.ok ? ok() : fail(r.error);
    }
    case "updateItem": {
      const item = await prisma.registryItem.findFirst({ where: { id: String(b.itemId ?? ""), registryId: registry.id } });
      if (!item) return fail("Item not found.", 404);
      const qty = Math.min(Math.max(Math.floor(Number(b.qty)) || 1, 1), 99);
      const priority = PRIORITIES[String(b.priority)] ? String(b.priority) : item.priority;
      await prisma.registryItem.update({
        where: { id: item.id },
        data: {
          quantityWanted: Math.max(qty, item.quantityPurchased, 1),
          priority,
          note: String(b.note ?? "").trim().slice(0, 200) || null,
        },
      });
      return ok();
    }
    case "removeItem":
      await prisma.registryItem.deleteMany({ where: { id: String(b.itemId ?? ""), registryId: registry.id } });
      return ok();
  }
  return fail("Unknown action.");
};
