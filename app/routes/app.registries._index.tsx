import type { LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { formatDate } from "../lib/registry.server";

const PAGE = 25;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1);
  const where = {
    shop: session.shop,
    ...(q ? { OR: [{ title: { contains: q } }, { ownerName: { contains: q } }] } : {}),
  };
  const [rows, count] = await Promise.all([
    prisma.registry.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      include: { _count: { select: { items: true, purchases: true } } },
    }),
    prisma.registry.count({ where }),
  ]);
  return {
    q, page, pages: Math.max(Math.ceil(count / PAGE), 1),
    rows: rows.map((r) => ({
      id: r.id, title: r.title, owner: r.ownerName, type: r.eventType, status: r.status,
      date: r.eventDate ? formatDate(r.eventDate) : "-", items: r._count.items, gifts: r._count.purchases, views: r.views,
    })),
  };
};

export default function Registries() {
  const { rows, q, page, pages } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Registries">
      <s-section>
        <Form method="get">
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-text-field label="Search by title or name" name="q" value={q}></s-text-field>
            <s-button type="submit">Search</s-button>
          </s-stack>
        </Form>
      </s-section>
      <s-section padding="none">
        {rows.length === 0 ? (
          <s-box padding="large"><s-text color="subdued">No registries found.</s-text></s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Registry</s-table-header>
              <s-table-header>Occasion</s-table-header>
              <s-table-header>Event date</s-table-header>
              <s-table-header>Items</s-table-header>
              <s-table-header>Gifts</s-table-header>
              <s-table-header>Views</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((r) => (
                <s-table-row key={r.id}>
                  <s-table-cell><s-link href={`/app/registries/${r.id}`}>{r.title}</s-link> <s-text color="subdued">{r.owner}</s-text></s-table-cell>
                  <s-table-cell>{r.type}</s-table-cell>
                  <s-table-cell>{r.date}</s-table-cell>
                  <s-table-cell>{r.items}</s-table-cell>
                  <s-table-cell>{r.gifts}</s-table-cell>
                  <s-table-cell>{r.views}</s-table-cell>
                  <s-table-cell><s-badge tone={r.status === "ACTIVE" ? "success" : "warning"}>{r.status === "ACTIVE" ? "Active" : "Hidden"}</s-badge></s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
      {pages > 1 && (
        <s-stack direction="inline" gap="base" justifyContent="center">
          {page > 1 && <s-link href={`/app/registries?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Previous</s-link>}
          <s-text>Page {page} of {pages}</s-text>
          {page < pages && <s-link href={`/app/registries?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Next</s-link>}
        </s-stack>
      )}
    </s-page>
  );
}
