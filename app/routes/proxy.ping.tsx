import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// Diagnostic page: yourshop.com/apps/registry/ping
// Shows on screen whether the proxy reaches the app, the app is installed, and the database tables exist.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid, session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  let db = "ok";
  try {
    await prisma.registrySettings.count();
    await prisma.registry.count();
    await prisma.registryImage.count();
    await prisma.registryEvent.count();
  } catch (e: any) {
    db = "PROBLEM (run: npx prisma migrate deploy) - " + String(e?.message ?? e).split("\n").slice(-2).join(" ").replace(/[{}%<>]/g, " ").slice(0, 220);
  }
  const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0"><b>${k}</b></td><td>${v}</td></tr>`;
  return liquid(
    `<div style="max-width:640px;margin:40px auto;padding:0 16px;font-family:sans-serif">
      <h2>Gift registry proxy is reaching your app &#9989;</h2>
      <table>${row("Shop", url.searchParams.get("shop") ?? "?")}
      ${row("App installed (session found)", session ? "yes" : "NO - open the app once in Shopify admin to install it")}
      ${row("Database tables", db)}
      ${row("Logged-in customer", url.searchParams.get("logged_in_customer_id") ? "yes" : "no")}</table>
      <p><a href="/apps/registry">Go to the registry page</a></p></div>`
  );
};
