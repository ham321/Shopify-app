import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// Serves registry photos: yourshop.com/apps/registry/img/<id>
// Photos live in the app database, so there is nothing extra to set up and nothing to pay for.
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const notFound = () => new Response("Not found", { status: 404 });
  if (!session || !params.id) return notFound();

  const img = await prisma.registryImage.findFirst({
    where: { id: params.id, shop: session.shop },
    include: { registry: { select: { status: true, customerId: true } } },
  });
  if (!img) return notFound();

  const customerId = new URL(request.url).searchParams.get("logged_in_customer_id");
  const isOwner = Boolean(customerId && customerId === img.registry.customerId);
  if (img.registry.status !== "ACTIVE" && !isOwner) return notFound();

  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.mime,
      "Content-Length": String(img.size),
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
};
