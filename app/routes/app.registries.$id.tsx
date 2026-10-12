import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  PRIORITIES, VISIBILITY, STATUS_LABEL, IMAGE_META, formatDate, money, numericId, itemStatus,
  hasAddress, shipFullLines, trackerTotals, imageUrl,
} from "../lib/registry.server";
import { registryInsights } from "../lib/analytics.server";
import { Kpi } from "../components/Charts";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const r = await prisma.registry.findFirst({
    where: { id: params.id, shop: session.shop },
    include: { items: { orderBy: { position: "asc" } }, purchases: { orderBy: { createdAt: "desc" } }, images: { select: IMAGE_META } },
  });
  if (!r) throw new Response("Registry not found", { status: 404 });
  const ins = await registryInsights(r.id, 30);
  const tot = trackerTotals(r.items);
  return {
    shop: session.shop,
    r: {
      id: r.id, slug: r.slug, title: r.title, owner: r.ownerName, type: r.eventType, status: r.status,
      date: r.eventDate ? formatDate(r.eventDate) : "-", visibility: VISIBILITY[r.visibility] ?? r.visibility,
      views: r.views, message: r.message, story: r.story, surprise: r.surpriseMode, created: formatDate(r.createdAt), palette: r.palette,
    },
    address: hasAddress(r) ? { lines: shipFullLines(r), phone: r.shipPhone, note: r.shipNote, publicFull: r.shipShowFull } : null,
    photos: r.images.map((i) => ({ id: i.id, kind: i.kind, url: `https://${session.shop}${imageUrl(i.id)}` })),
    tracker: { pct: tot.pct, ...tot.counts, wanted: tot.wanted, got: tot.got },
    insights: ins.totals,
    items: r.items.map((i) => ({
      id: i.id, title: i.title, variant: i.variantTitle, price: money(i.price, i.currency),
      wanted: i.quantityWanted, got: i.quantityPurchased, priority: PRIORITIES[i.priority] ?? i.priority,
      status: STATUS_LABEL[itemStatus(i)], statusKey: itemStatus(i), clicks: ins.clicksByItem.get(i.id) ?? 0,
      adminUrl: `shopify://admin/products/${numericId(i.productId)}`,
    })),
    purchases: r.purchases.map((p) => ({
      id: p.id, who: p.gifterName || "-", item: p.itemTitle, qty: p.quantity, order: p.orderName ?? p.orderId,
      amount: money(p.amount, p.currency), message: p.giftMessage ?? "", thanked: p.thanked, date: formatDate(p.createdAt),
      toRegistry: p.shippedToRegistry,
    })),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = String(fd.get("intent"));
  const where = { id: params.id, shop: session.shop };
  if (intent === "toggle") {
    const r = await prisma.registry.findFirst({ where });
    if (r) await prisma.registry.update({ where: { id: r.id }, data: { status: r.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" } });
    return { ok: true };
  }
  if (intent === "delete") {
    await prisma.registry.deleteMany({ where });
    return redirect("/app/registries");
  }
  return { ok: false };
};

export default function RegistryDetail() {
  const { r, items, purchases, shop, address, photos, tracker, insights } = useLoaderData<typeof loader>();
  const hidden = r.status !== "ACTIVE";
  return (
    <s-page heading={r.title}>
      <s-link slot="breadcrumb-actions" href="/app/registries">Registries</s-link>
      <s-link slot="secondary-actions" href={`https://${shop}/apps/registry/r/${r.slug}`} target="_blank">View on storefront</s-link>
      {hidden && <s-banner tone="warning" heading="Hidden from guests">Guests can't see this registry until you show it again.</s-banner>}

      <s-section heading="Tracker & performance">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="base">
          <Kpi label="Complete" value={`${tracker.pct}%`} hint={`${tracker.got} of ${tracker.wanted} gifts`} />
          <Kpi label="Gifted items" value={tracker.GIFTED} />
          <Kpi label="Partly gifted" value={tracker.PARTIAL} />
          <Kpi label="Still needed" value={tracker.NEEDED} />
          <Kpi label="Views (30d)" value={insights.views} hint={`${insights.visitors} visitors`} />
          <Kpi label="Gift clicks (30d)" value={insights.giftClicks} />
        </s-grid>
      </s-section>

      <s-section heading="Details">
        <s-stack gap="small-200">
          <s-text>Names: {r.owner}</s-text>
          <s-text>Occasion: {r.type} ({r.date})</s-text>
          <s-text>Visibility: {r.visibility}</s-text>
          <s-text>Total guest views: {r.views}</s-text>
          <s-text>Created: {r.created}</s-text>
          <s-text>Design: {r.palette === "STORE" ? "Store default" : r.palette}</s-text>
          {r.surprise && <s-text color="subdued">Surprise mode is on for the registry owner.</s-text>}
          {r.message && <s-text color="subdued">"{r.message}"</s-text>}
          {r.story && <s-text color="subdued">Story: {r.story}</s-text>}
        </s-stack>
      </s-section>

      <s-section heading="Delivery address">
        {address ? (
          <s-stack gap="small-200">
            {address.lines.map((l, i) => <s-text key={i}>{l}</s-text>)}
            {address.phone && <s-text>Phone: {address.phone}</s-text>}
            {address.note && <s-text color="subdued">Note: {address.note}</s-text>}
            <s-text color="subdued">{address.publicFull ? "Shown to guests on the registry page." : "Hidden from guests; only used to pre-fill checkout."}</s-text>
          </s-stack>
        ) : (
          <s-text color="subdued">No delivery address set.</s-text>
        )}
      </s-section>

      {photos.length > 0 && (
        <s-section heading={`Photos (${photos.length})`}>
          <s-stack direction="inline" gap="base">
            {photos.map((p) => <img key={p.id} src={p.url} alt={p.kind} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />)}
          </s-stack>
        </s-section>
      )}

      <s-section heading={`Items (${items.length})`} padding="none">
        {items.length === 0 ? (
          <s-box padding="base"><s-text color="subdued">No items yet.</s-text></s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header><s-table-header>Price</s-table-header><s-table-header>Priority</s-table-header>
              <s-table-header>Status</s-table-header><s-table-header>Received</s-table-header><s-table-header>Clicks (30d)</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {items.map((i) => (
                <s-table-row key={i.id}>
                  <s-table-cell><s-link href={i.adminUrl} target="_top">{i.title}</s-link> {i.variant && <s-text color="subdued">{i.variant}</s-text>}</s-table-cell>
                  <s-table-cell>{i.price}</s-table-cell>
                  <s-table-cell>{i.priority}</s-table-cell>
                  <s-table-cell><s-badge tone={i.statusKey === "GIFTED" ? "success" : i.statusKey === "PARTIAL" ? "warning" : "neutral"}>{i.status}</s-badge></s-table-cell>
                  <s-table-cell>{i.got} / {i.wanted}</s-table-cell>
                  <s-table-cell>{i.clicks}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading={`Gifts bought (${purchases.length})`} padding="none">
        {purchases.length === 0 ? (
          <s-box padding="base"><s-text color="subdued">No gifts yet.</s-text></s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Date</s-table-header><s-table-header>From</s-table-header><s-table-header>Gift</s-table-header>
              <s-table-header>Order</s-table-header><s-table-header>Amount</s-table-header><s-table-header>Ship to registry</s-table-header>
              <s-table-header>Message</s-table-header><s-table-header>Thanked</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {purchases.map((p) => (
                <s-table-row key={p.id}>
                  <s-table-cell>{p.date}</s-table-cell><s-table-cell>{p.who}</s-table-cell>
                  <s-table-cell>{p.qty} x {p.item}</s-table-cell><s-table-cell>{p.order}</s-table-cell>
                  <s-table-cell>{p.amount}</s-table-cell><s-table-cell>{p.toRegistry ? "Yes" : "No"}</s-table-cell>
                  <s-table-cell>{p.message}</s-table-cell><s-table-cell>{p.thanked ? "Yes" : "No"}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading="Moderation">
        <s-stack direction="inline" gap="base">
          <Form method="post">
            <input type="hidden" name="intent" value="toggle" />
            <s-button type="submit">{hidden ? "Show to guests" : "Hide from guests"}</s-button>
          </Form>
          <Form method="post" onSubmit={(e) => { if (!confirm("Delete this registry and its history?")) e.preventDefault(); }}>
            <input type="hidden" name="intent" value="delete" />
            <s-button type="submit" tone="critical">Delete registry</s-button>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}
