import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getSettings } from "../lib/registry.server";
import { EVENT_TYPES, recordEvent } from "../lib/analytics.server";

// Anonymous analytics beacon: POST yourshop.com/apps/registry/track  (VIEW | GIFT_CLICK | SHARE)
const quiet = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export const loader = async (_: LoaderFunctionArgs) => quiet();

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return quiet();

  const settings = await getSettings(session.shop);
  if (!settings.enabled || !settings.analyticsEnabled) return quiet();

  const customerId = new URL(request.url).searchParams.get("logged_in_customer_id") || null;
  const fd = await request.formData().catch(() => null);
  if (!fd) return quiet();

  const type = String(fd.get("type") ?? "") as (typeof EVENT_TYPES)[number];
  if (!EVENT_TYPES.includes(type)) return quiet();

  const registry = await prisma.registry.findUnique({
    where: { shop_slug: { shop: session.shop, slug: String(fd.get("slug") ?? "").slice(0, 80) } },
    select: { id: true, customerId: true, status: true },
  });
  if (!registry || registry.status !== "ACTIVE") return quiet();
  if (customerId && registry.customerId === customerId) return quiet(); // the owner's own visits never count

  const clean = (k: string, re: RegExp, max: number) => {
    const v = String(fd.get(k) ?? "").slice(0, max);
    return re.test(v) ? v : null;
  };
  const visitor = clean("visitor", /^[a-z0-9]{8,40}$/i, 40);
  const channel = clean("channel", /^[a-z0-9_-]{1,20}$/i, 20)?.toLowerCase() ?? null;

  let itemId: string | null = clean("itemId", /^[a-z0-9]{10,40}$/i, 40);
  if (itemId) {
    const exists = await prisma.registryItem.findFirst({ where: { id: itemId, registryId: registry.id }, select: { id: true } });
    if (!exists) itemId = null;
  }

  await recordEvent({ shop: session.shop, registryId: registry.id, type, itemId, channel: type === "GIFT_CLICK" ? null : channel, visitor });
  return quiet();
};
