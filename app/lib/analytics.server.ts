import prisma from "../db.server";

/**
 * Registry analytics.
 *
 * Storefront pages send tiny anonymous events (VIEW, GIFT_CLICK, SHARE) to /apps/registry/track.
 * Purchases come from the orders/paid webhook, so revenue numbers are real orders, not clicks.
 * "visitor" is a random id kept in the shopper's browser. It is not linked to a name, email or IP.
 */

export const EVENT_TYPES = ["VIEW", "GIFT_CLICK", "SHARE"] as const;

export async function recordEvent(e: {
  shop: string;
  registryId: string;
  type: (typeof EVENT_TYPES)[number];
  itemId?: string | null;
  channel?: string | null;
  visitor?: string | null;
}) {
  // A refresh or a second tab shouldn't count as a new view: one view per visitor per registry per 30 minutes.
  // Double-clicks on gift / share buttons are collapsed within 5 seconds.
  if (e.visitor) {
    const windowMs = e.type === "VIEW" ? 30 * 60_000 : 5_000;
    const recent = await prisma.registryEvent.findFirst({
      where: {
        registryId: e.registryId,
        type: e.type,
        visitor: e.visitor,
        ...(e.type === "VIEW" ? {} : { itemId: e.itemId ?? null, channel: e.channel ?? null }),
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
      select: { id: true },
    });
    if (recent) return false;
  }
  await prisma.registryEvent.create({
    data: {
      shop: e.shop,
      registryId: e.registryId,
      type: e.type,
      itemId: e.itemId ?? null,
      channel: e.channel ?? null,
      visitor: e.visitor ?? null,
    },
  });
  if (e.type === "VIEW") await prisma.registry.update({ where: { id: e.registryId }, data: { views: { increment: 1 } } });
  return true;
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** The last `n` UTC days, oldest first, ending today. */
export function lastDays(n: number) {
  const out: string[] = [];
  const t = new Date();
  const base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(base - i * 864e5)));
  return out;
}

const sinceDate = (days: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - (days - 1) * 864e5);

const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const sortedEntries = (m: Map<string, number>, n = 6) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export { SOURCE_LABELS } from "./shared";

/* ------------------------- one registry (owner view) ------------------------- */

export async function registryInsights(registryId: string, days = 30) {
  const since = sinceDate(days);
  const [events, purchases] = await Promise.all([
    prisma.registryEvent.findMany({
      where: { registryId, createdAt: { gte: since } },
      select: { type: true, createdAt: true, visitor: true, channel: true, itemId: true },
      take: 50_000,
    }),
    prisma.purchase.findMany({
      where: { registryId, createdAt: { gte: since } },
      select: { createdAt: true, quantity: true },
    }),
  ]);

  const keys = lastDays(days);
  const views = new Map(keys.map((k) => [k, 0]));
  const gifts = new Map(keys.map((k) => [k, 0]));
  const visitors = new Set<string>();
  const sources = new Map<string, number>();
  const clicksByItem = new Map<string, number>();
  let giftClicks = 0;
  let shares = 0;

  for (const e of events) {
    const k = dayKey(e.createdAt);
    if (e.type === "VIEW") {
      if (views.has(k)) bump(views, k);
      if (e.visitor) visitors.add(e.visitor);
      bump(sources, e.channel || "direct");
    } else if (e.type === "GIFT_CLICK") {
      giftClicks++;
      if (e.itemId) bump(clicksByItem, e.itemId);
    } else if (e.type === "SHARE") shares++;
  }
  let giftsBought = 0;
  for (const p of purchases) {
    const k = dayKey(p.createdAt);
    if (gifts.has(k)) bump(gifts, k, p.quantity);
    giftsBought += p.quantity;
  }

  return {
    days: keys,
    views: keys.map((k) => views.get(k) ?? 0),
    gifts: keys.map((k) => gifts.get(k) ?? 0),
    totals: {
      views: [...views.values()].reduce((a, b) => a + b, 0),
      visitors: visitors.size,
      giftClicks,
      shares,
      giftsBought,
    },
    sources: sortedEntries(sources),
    clicksByItem,
  };
}

/* ------------------------- whole store (merchant view) ------------------------- */

export async function shopInsights(shop: string, days: number) {
  const since = sinceDate(days);
  const [events, purchases, registriesCreated, itemsAdded, occasions, wantedAgg, topWanted] = await Promise.all([
    prisma.registryEvent.findMany({
      where: { shop, createdAt: { gte: since } },
      select: { type: true, createdAt: true, visitor: true, channel: true, registryId: true, itemId: true },
      take: 200_000,
    }),
    prisma.purchase.findMany({
      where: { shop, createdAt: { gte: since } },
      select: { createdAt: true, quantity: true, amount: true, currency: true, registryId: true, itemTitle: true, shippedToRegistry: true },
    }),
    prisma.registry.count({ where: { shop, createdAt: { gte: since } } }),
    prisma.registryItem.count({ where: { registry: { shop }, createdAt: { gte: since } } }),
    prisma.registry.groupBy({ by: ["eventType"], where: { shop }, _count: { _all: true }, orderBy: { _count: { eventType: "desc" } } }),
    prisma.registryItem.aggregate({ where: { registry: { shop } }, _sum: { quantityWanted: true, quantityPurchased: true } }),
    prisma.registryItem.groupBy({
      by: ["title"],
      where: { registry: { shop } },
      _sum: { quantityWanted: true, quantityPurchased: true },
      orderBy: { _sum: { quantityWanted: "desc" } },
      take: 8,
    }),
  ]);

  const keys = lastDays(days);
  const mk = () => new Map(keys.map((k) => [k, 0]));
  const views = mk();
  const clicks = mk();
  const gifts = mk();
  const revenue = mk();
  const visitors = new Set<string>();
  const sources = new Map<string, number>();
  const shareChannels = new Map<string, number>();

  type RegAgg = { views: number; clicks: number; gifts: number; revenue: number; visitors: Set<string> };
  const byReg = new Map<string, RegAgg>();
  const reg = (id: string) => {
    let r = byReg.get(id);
    if (!r) byReg.set(id, (r = { views: 0, clicks: 0, gifts: 0, revenue: 0, visitors: new Set() }));
    return r;
  };

  let viewCount = 0;
  let clickCount = 0;
  let shareCount = 0;
  for (const e of events) {
    const k = dayKey(e.createdAt);
    const r = reg(e.registryId);
    if (e.type === "VIEW") {
      viewCount++;
      r.views++;
      if (views.has(k)) bump(views, k);
      if (e.visitor) {
        visitors.add(e.visitor);
        r.visitors.add(e.visitor);
      }
      bump(sources, e.channel || "direct");
    } else if (e.type === "GIFT_CLICK") {
      clickCount++;
      r.clicks++;
      if (clicks.has(k)) bump(clicks, k);
    } else if (e.type === "SHARE") {
      shareCount++;
      bump(shareChannels, e.channel || "copy");
    }
  }

  let giftsBought = 0;
  let sales = 0;
  let toRegistry = 0;
  const byItem = new Map<string, { qty: number; revenue: number }>();
  for (const p of purchases) {
    const k = dayKey(p.createdAt);
    const r = reg(p.registryId);
    r.gifts += p.quantity;
    r.revenue += p.amount;
    giftsBought += p.quantity;
    sales += p.amount;
    if (p.shippedToRegistry) toRegistry += p.quantity;
    if (gifts.has(k)) bump(gifts, k, p.quantity);
    if (revenue.has(k)) bump(revenue, k, p.amount);
    const it = byItem.get(p.itemTitle) ?? { qty: 0, revenue: 0 };
    it.qty += p.quantity;
    it.revenue += p.amount;
    byItem.set(p.itemTitle, it);
  }

  const topIds = [...byReg.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue || b[1].views - a[1].views)
    .slice(0, 8);
  const titles = topIds.length
    ? await prisma.registry.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, title: true, ownerName: true } })
    : [];
  const titleOf = new Map(titles.map((t) => [t.id, t]));

  const wanted = wantedAgg._sum.quantityWanted ?? 0;
  const got = wantedAgg._sum.quantityPurchased ?? 0;

  return {
    days: keys,
    series: {
      views: keys.map((k) => views.get(k) ?? 0),
      clicks: keys.map((k) => clicks.get(k) ?? 0),
      gifts: keys.map((k) => gifts.get(k) ?? 0),
      revenue: keys.map((k) => revenue.get(k) ?? 0),
    },
    currency: purchases[0]?.currency ?? "USD",
    kpis: {
      registriesCreated,
      itemsAdded,
      views: viewCount,
      visitors: visitors.size,
      giftClicks: clickCount,
      shares: shareCount,
      giftsBought,
      sales,
      avgGift: giftsBought ? sales / giftsBought : 0,
      conversion: visitors.size ? (purchases.length / visitors.size) * 100 : 0,
      shipToRegistryPct: giftsBought ? Math.round((toRegistry / giftsBought) * 100) : 0,
      completionPct: wanted ? Math.min(Math.round((got / wanted) * 100), 100) : 0,
    },
    topRegistries: topIds.map(([id, a]) => ({
      id,
      title: titleOf.get(id)?.title ?? "(deleted registry)",
      owner: titleOf.get(id)?.ownerName ?? "",
      views: a.views,
      visitors: a.visitors.size,
      clicks: a.clicks,
      gifts: a.gifts,
      revenue: a.revenue,
    })),
    topPurchased: [...byItem.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8).map(([title, v]) => ({ title, ...v })),
    topWanted: topWanted.map((t) => ({ title: t.title, wanted: t._sum.quantityWanted ?? 0, got: t._sum.quantityPurchased ?? 0 })),
    sources: sortedEntries(sources, 8),
    shareChannels: sortedEntries(shareChannels, 6),
    occasions: occasions.map((o) => ({ type: o.eventType, count: o._count._all })),
  };
}
