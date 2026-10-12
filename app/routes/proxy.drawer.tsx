import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getSettings } from "../lib/registry.server";

// JSON for the storefront sidebar: yourshop.com/apps/registry/drawer
// Returns the signed-in customer's registries with progress. Guests get loggedIn:false.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id") || null;
  const headers = { "Cache-Control": "no-store" };
  if (!session) return Response.json({ enabled: false, loggedIn: Boolean(customerId), registries: [] }, { headers });

  const settings = await getSettings(session.shop);
  if (!customerId || !settings.enabled)
    return Response.json({ enabled: settings.enabled, loggedIn: Boolean(customerId), registries: [] }, { headers });

  const mine = await prisma.registry.findMany({
    where: { shop: session.shop, customerId },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { quantityWanted: true, quantityPurchased: true } } },
  });
  return Response.json(
    {
      enabled: true,
      loggedIn: true,
      canCreate: mine.length < settings.maxRegistriesPerUser,
      registries: mine.map((r) => {
        const wanted = r.items.reduce((n, i) => n + i.quantityWanted, 0);
        const got = r.items.reduce((n, i) => n + Math.min(i.quantityPurchased, i.quantityWanted), 0);
        return { id: r.id, slug: r.slug, title: r.title, eventType: r.eventType, wanted, got };
      }),
    },
    { headers }
  );
};
