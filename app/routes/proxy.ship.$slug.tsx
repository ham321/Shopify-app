import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import prisma from "../db.server";
import { proxyCtx } from "../lib/ui.server";
import { checkPassword, checkoutPrefillUrl, hasAddress } from "../lib/registry.server";

// yourshop.com/apps/registry/ship/<slug>
// The guest's gift is already in their cart. This sends them to checkout with the registry owner's
// delivery address filled in, so the gift goes straight to the owner. If anything looks off we just
// fall back to the normal cart page.
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop, customerId, url } = await proxyCtx(request);
  const registry = await prisma.registry.findUnique({ where: { shop_slug: { shop, slug: params.slug ?? "" } } });
  if (!registry || registry.status !== "ACTIVE" || !hasAddress(registry)) return redirect("/cart");

  const isOwner = Boolean(customerId && registry.customerId === customerId);
  if (registry.visibility === "PASSWORD" && !isOwner && !checkPassword(url.searchParams.get("pw") ?? "", registry.password))
    return redirect("/cart");

  return redirect(checkoutPrefillUrl(registry));
};
