import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { revertRegistryPurchases } from "../lib/purchases.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  await revertRegistryPurchases(shop, String((payload as any).id));
  return new Response();
};
