import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);
  // Registry data is kept until Shopify sends shop/redact (48h later), in case of a quick reinstall.
  await db.session.deleteMany({ where: { shop } });
  return new Response();
};
