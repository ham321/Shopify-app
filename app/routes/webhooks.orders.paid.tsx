import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { recordRegistryPurchases } from "../lib/purchases.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  await recordRegistryPurchases(shop, payload);
  return new Response();
};
