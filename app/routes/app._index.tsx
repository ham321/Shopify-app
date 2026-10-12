import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings, money, formatDate } from "../lib/registry.server";
import { shopInsights } from "../lib/analytics.server";
import { Bars, Kpi } from "../components/Charts";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const now = new Date();
  const in30 = new Date(Date.now() + 30 * 864e5);
  const [settings, total, active, items, sums, recent, upcoming, insights] = await Promise.all([
    getSettings(shop),
    prisma.registry.count({ where: { shop } }),
    prisma.registry.count({ where: { shop, status: "ACTIVE" } }),
    prisma.registryItem.count({ where: { registry: { shop } } }),
    prisma.purchase.aggregate({ where: { shop }, _sum: { quantity: true, amount: true } }),
    prisma.registry.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.registry.findMany({ where: { shop, status: "ACTIVE", eventDate: { gte: now, lte: in30 } }, orderBy: { eventDate: "asc" }, take: 5 }),
    shopInsights(shop, 30),
  ]);
  return {
    shop,
    enabled: settings.enabled,
    total, active, items,
    gifts: sums._sum.quantity ?? 0,
    revenue: money(sums._sum.amount ?? 0, insights.currency),
    views30: insights.series.views,
    gifts30: insights.series.gifts,
    days: insights.days,
    k: insights.kpis,
    recent: recent.map((r) => ({ id: r.id, title: r.title, owner: r.ownerName, created: formatDate(r.createdAt) })),
    upcoming: upcoming.map((r) => ({ id: r.id, title: r.title, date: formatDate(r.eventDate) })),
  };
};

export default function Dashboard() {
  const d = useLoaderData<typeof loader>();
  return (
    <s-page heading="Gift registry">
      <s-button slot="primary-action" href="/app/analytics">Full analytics</s-button>
      {!d.enabled && (
        <s-banner tone="warning" heading="Registries are switched off">
          Customers can't create or browse registries until you turn them on in Settings.
        </s-banner>
      )}
      <s-section heading="All time">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Kpi label="Registries" value={d.total} hint={`${d.active} active`} />
          <Kpi label="Items registered" value={d.items} />
          <Kpi label="Gifts bought" value={d.gifts} />
          <Kpi label="Registry sales" value={d.revenue} />
        </s-grid>
      </s-section>

      <s-section heading="Last 30 days">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <Kpi label="Registry views" value={d.k.views} hint={`${d.k.visitors} visitors`} />
          <Kpi label="Gift clicks" value={d.k.giftClicks} />
          <Kpi label="New registries" value={d.k.registriesCreated} />
        </s-grid>
        <s-box paddingBlockStart="base"><Bars values={d.views30} labels={d.days} /></s-box>
      </s-section>

      <s-section heading="Events in the next 30 days">
        {d.upcoming.length === 0 && <s-text color="subdued">No upcoming events.</s-text>}
        <s-stack gap="small-200">
          {d.upcoming.map((r) => (
            <s-link key={r.id} href={`/app/registries/${r.id}`}>{r.date} - {r.title}</s-link>
          ))}
        </s-stack>
      </s-section>

      <s-section heading="Newest registries">
        {d.recent.length === 0 && <s-text color="subdued">Nothing yet. Share your registry page with customers to get started.</s-text>}
        <s-stack gap="small-200">
          {d.recent.map((r) => (
            <s-link key={r.id} href={`/app/registries/${r.id}`}>{r.title} ({r.owner}) - {r.created}</s-link>
          ))}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Go live in 4 steps">
        <s-ordered-list>
          <s-list-item>Theme editor &rarr; App embeds &rarr; switch on <s-text type="strong">Gift registry sidebar</s-text>.</s-list-item>
          <s-list-item>Product template &rarr; Add block &rarr; Apps &rarr; <s-text type="strong">Add to gift registry</s-text> button.</s-list-item>
          <s-list-item>Add a menu link to <s-text type="strong">/apps/registry</s-text> (Online Store &rarr; Navigation).</s-list-item>
          <s-list-item>Place a test order from a registry link; the tracker and these numbers update automatically.</s-list-item>
        </s-ordered-list>
        <s-link href={`https://${d.shop}/apps/registry`} target="_blank">Open storefront registry page</s-link>
      </s-section>
    </s-page>
  );
}
