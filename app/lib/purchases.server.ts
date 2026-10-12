import prisma from "../db.server";

type Line = { id: number | string; quantity: number; price: string; properties?: { name: string; value: string }[] };

/** Called for orders/paid. Idempotent: Shopify may deliver the same webhook more than once. */
export async function recordRegistryPurchases(shop: string, order: any) {
  for (const li of (order.line_items ?? []) as Line[]) {
    const props = Object.fromEntries((li.properties ?? []).map((p) => [p.name, p.value]));
    const registryId = props["_registry_id"];
    const itemId = props["_registry_item"];
    if (!registryId || !itemId) continue;

    const registry = await prisma.registry.findFirst({ where: { id: registryId, shop } });
    if (!registry) continue;
    const item = await prisma.registryItem.findFirst({ where: { id: itemId, registryId } });

    const key = { shop, orderId: String(order.id), lineItemId: String(li.id) };
    if (await prisma.purchase.findUnique({ where: { shop_orderId_lineItemId: key } })) continue;

    const qty = Math.max(Number(li.quantity) || 1, 1);
    await prisma.$transaction([
      prisma.purchase.create({
        data: {
          ...key,
          registryId,
          itemId: item?.id ?? null,
          itemTitle: item?.title ?? "Gift",
          orderName: order.name ?? null,
          quantity: qty,
          amount: (parseFloat(li.price) || 0) * qty,
          currency: order.currency ?? "USD",
          gifterName: props["Gift from"]?.slice(0, 60) || null,
          giftMessage: props["Gift message"]?.slice(0, 200) || null,
          shippedToRegistry: props["_ship_to_registry"] === "1",
          anonymous: props["_anon"] === "1",
        },
      }),
      ...(item ? [prisma.registryItem.update({ where: { id: item.id }, data: { quantityPurchased: { increment: qty } } })] : []),
    ]);
  }
}

/** Called for orders/cancelled: put the gifts back on the registry. */
export async function revertRegistryPurchases(shop: string, orderId: string) {
  const rows = await prisma.purchase.findMany({ where: { shop, orderId } });
  for (const p of rows) {
    await prisma.$transaction([
      ...(p.itemId ? [prisma.registryItem.update({ where: { id: p.itemId }, data: { quantityPurchased: { decrement: p.quantity } } })] : []),
      prisma.purchase.delete({ where: { id: p.id } }),
    ]);
  }
}
