import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { shopInsights } from "../lib/analytics.server";
import { SOURCE_LABELS, money } from "../lib/shared";
import { Bars, HBars, Kpi } from "../components/Charts";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const raw = parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10);
  const days = [7, 30, 90].includes(raw) ? raw : 30;
  const d = await shopInsights(session.shop, days);
  return { days, d };
};

export default function Analytics() {
  const { days, d } = useLoaderData<typeof loader>();
  const k = d.kpis;
  const m = (n: number) => money(n, d.currency);
  return (
    <s-page heading="Registry analytics">
      <s-stack direction="inline" gap="small" slot="primary-action">
        {[7, 30, 90].map((n) => (
          <s-button key={n} href={`/app/analytics?days=${n}`} variant={n === days ? "primary" : "secondary"}>{n} days</s-button>
        ))}
      </s-stack>

      <s-section heading={`Last ${days} days`}>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
          <Kpi label="Registry views" value={k.views} hint={`${k.visitors} unique visitors`} />
          <Kpi label="Gift clicks" value={k.giftClicks} hint="Taps on 'Gift this'" />
          <Kpi label="Gifts bought" value={k.giftsBought} hint={`${k.conversion.toFixed(1)}% of visitors bought`} />
          <Kpi label="Registry sales" value={m(k.sales)} hint={`${m(k.avgGift)} avg per gift`} />
          <Kpi label="New registries" value={k.registriesCreated} hint={`${k.itemsAdded} items added`} />
          <Kpi label="Registry completion" value={`${k.completionPct}%`} hint="All items, all time" />
          <Kpi label="Shipped to the registry owner" value={`${k.shipToRegistryPct}%`} hint="Of gifts bought" />
          <Kpi label="Times shared" value={k.shares} />
        </s-grid>
      </s-section>

      <s-section heading="Registry views per day">
        <Bars values={d.series.views} labels={d.days} color="#6366f1" />
      </s-section>
      <s-section heading="Gifts bought per day">
        <Bars values={d.series.gifts} labels={d.days} color="#16a34a" />
      </s-section>
      <s-section heading="Registry sales per day">
        <Bars values={d.series.revenue} labels={d.days} color="#d97706" format={m} />
      </s-section>

      <s-section heading="Funnel">
        <HBars rows={[["Visitors", k.visitors], ["Gift clicks", k.giftClicks], ["Gifts bought", k.giftsBought]]} color="#7c3aed" />
      </s-section>

      <s-section heading="Top registries" padding="none">
        {d.topRegistries.length === 0 ? (
          <s-box padding="base"><s-text color="subdued">No activity in this period yet.</s-text></s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Registry</s-table-header><s-table-header>Views</s-table-header><s-table-header>Visitors</s-table-header>
              <s-table-header>Gift clicks</s-table-header><s-table-header>Gifts</s-table-header><s-table-header>Sales</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {d.topRegistries.map((r) => (
                <s-table-row key={r.id}>
                  <s-table-cell><s-link href={`/app/registries/${r.id}`}>{r.title}</s-link> <s-text color="subdued">{r.owner}</s-text></s-table-cell>
                  <s-table-cell>{r.views}</s-table-cell><s-table-cell>{r.visitors}</s-table-cell>
                  <s-table-cell>{r.clicks}</s-table-cell><s-table-cell>{r.gifts}</s-table-cell><s-table-cell>{m(r.revenue)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading="Most-wanted products (all time)" padding="none">
        {d.topWanted.length === 0 ? (
          <s-box padding="base"><s-text color="subdued">Nothing on registries yet.</s-text></s-box>
        ) : (
          <s-table>
            <s-table-header-row><s-table-header>Product</s-table-header><s-table-header>Wanted</s-table-header><s-table-header>Gifted</s-table-header></s-table-header-row>
            <s-table-body>
              {d.topWanted.map((p) => (
                <s-table-row key={p.title}><s-table-cell>{p.title}</s-table-cell><s-table-cell>{p.wanted}</s-table-cell><s-table-cell>{p.got}</s-table-cell></s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading="Best-selling gifts (this period)">
        {d.topPurchased.length === 0 ? <s-text color="subdued">No gifts bought in this period.</s-text> : <HBars rows={d.topPurchased.map((p) => [p.title, p.qty])} color="#16a34a" />}
      </s-section>

      <s-section slot="aside" heading="Where visitors come from">
        <HBars rows={d.sources.map(([key, n]) => [SOURCE_LABELS[key] ?? key, n])} />
      </s-section>
      <s-section slot="aside" heading="How registries are shared">
        <HBars rows={d.shareChannels.map(([key, n]) => [SOURCE_LABELS[key] ?? key, n])} color="#0ea5e9" />
      </s-section>
      <s-section slot="aside" heading="Occasions">
        <HBars rows={d.occasions.map((o) => [o.type, o.count])} color="#db2777" />
      </s-section>
    </s-page>
  );
}
