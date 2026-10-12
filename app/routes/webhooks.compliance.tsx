import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Mandatory privacy webhooks for App Store apps (customers/data_request, customers/redact, shop/redact).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const p: any = payload;
  switch (topic) {
    case "CUSTOMERS_REDACT":
      if (p.customer?.id) await prisma.registry.deleteMany({ where: { shop, customerId: String(p.customer.id) } });
      break;
    case "SHOP_REDACT":
      await prisma.registry.deleteMany({ where: { shop } });
      await prisma.registrySettings.deleteMany({ where: { shop } });
      await prisma.session.deleteMany({ where: { shop } });
      break;
    case "CUSTOMERS_DATA_REQUEST":
      // The only customer data stored is the numeric customer id plus the names/messages the customer typed
      // into their registries. Send those to the merchant on request.
      break;
  }
  return new Response();
};
