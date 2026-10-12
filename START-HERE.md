# Gift Registry app: setup guide

A full gift registry for Shopify: guests see a live **tracker** (still needed / partly gifted / gifted),
owners get photos, colours, fonts, a delivery address and their own insights, and you get store-wide analytics.

## What's in the box
| Where | What |
|---|---|
| `app/routes/proxy.*` | The storefront pages your customers see (`yourstore.com/apps/registry`) |
| `app/routes/app.*` | The admin pages: Dashboard, Registries, **Analytics**, **Settings** (with live colour preview) |
| `extensions/registry-button` | Theme blocks: **Add to gift registry** button, sidebar launcher, "Find a registry" search box |
| `prisma/` | Database schema + migrations (photos, address, analytics events) |
| `shopify.app.shopham.toml` | App config, **now registers the order webhooks** that power the tracker |

## 1. Run it on a development store (about 10 minutes)
Needs: Node 22.12+, a Shopify Partner account, a dev store.

```bash
npm install
npx prisma generate
npx prisma migrate deploy      # creates/updates the database (keeps your existing data)
npm run dev                    # = shopify app dev
```
* Log in when asked, choose your existing app (ShopHam) and dev store.
* Press **p** to open the app. Approve permissions.
* Keep this terminal open: it is your tunnel + server while testing.

## 2. Put the registry on your storefront (Online Store > Themes > Customize)
1. **App embeds** (left sidebar icon) > switch on **Gift registry sidebar**. Pick tab or round button, colours, side.
2. Open a **Product** template > **Add block** > **Apps** > **Add to gift registry**. Style it (colour, shape, size, icon). Save.
3. Any page > Add section/block > **Find a registry** (search box), optional.
4. **Online Store > Navigation**: add a menu link to `/apps/registry`.
5. Settings > **Customer accounts**: customers must be able to log in to create registries.

## 3. Test the whole flow
1. Visit `yourstore.com/apps/registry/ping`. Every line should say yes/ok. If not, it tells you what's wrong.
2. Log in as a test customer > Create a registry > add products > **Photos**, **Design**, **Delivery** tabs.
3. Open the registry in a private window (as a guest): you'll see the tracker.
4. Click **Gift this** > "Send it straight to..." > checkout opens with the address pre-filled. Complete a test order
   (Settings > Payments > Bogus Gateway on a dev store).
5. Within seconds the item flips to "Gifted"/"Partly gifted", and numbers appear in **Analytics**.

## 4. Going live on real stores
A dev tunnel only works while `npm run dev` runs. For real stores:
1. **Host the app** (Fly.io, Render, Railway, Google Cloud Run...). The included `Dockerfile` works.
   Set env vars: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL` (your https URL), `NODE_ENV=production`.
2. **Database.** SQLite is fine for one small server *with a persistent disk*. For anything bigger use Postgres:
   in `prisma/schema.prisma` change `provider = "postgresql"` and `url = env("DATABASE_URL")`,
   delete the `prisma/migrations` folder, run `npx prisma migrate dev --name init` once against an empty Postgres DB, commit.
3. Put your real URL in `shopify.app.shopham.toml` (`application_url`, `redirect_urls`, `[app_proxy] url = "https://YOUR-HOST/proxy"`).
4. `npm run deploy` publishes the config, webhooks and theme extension to Shopify.
5. **Install on stores**: Partner Dashboard > your app > **Distribution**. *Custom distribution* gives an install link for
   one merchant (all their stores). *Shopify App Store* is for the public. Each merchant then repeats step 2 above (theme embed + menu link).
6. For the App Store: remove scopes you don't use (this app only needs `read_products` and `read_orders`), and complete
   *Protected customer data* in the Partner Dashboard.

## Privacy notes
* Registry **photos** are stored in your database (resized in the browser to about 1600 px). Nothing is sent to third parties.
* **Analytics** use a random anonymous visitor id kept in the shopper's browser (no name, email or IP).
  If your shoppers are in regions that require cookie/storage consent, switch it off in Settings > Features.
* A delivery address is never printed on the page unless the owner turns on "Show my full street address".
  Note it *is* visible in the checkout URL a guest is sent to when they choose "Send it straight to..." (that is how it gets pre-filled).

## Troubleshooting
| Symptom | Fix |
|---|---|
| Tracker never changes after a test order | Run `npm run deploy` (or restart `npm run dev`) so the `orders/paid` webhook is registered. Check the order's line item has `_registry_id` properties. |
| `/apps/registry` shows a Shopify 404 | App proxy not set: run `npm run dev`/`deploy` again; check `[app_proxy]` in the toml. |
| "isn't ready yet" message | Open the app once in the Shopify admin so it installs/creates a session. |
| Photo upload says failed | Choose a JPG/PNG/WebP/GIF; very large files are shrunk automatically but need JavaScript enabled. |
| Address not pre-filled at checkout | Shopify's checkout controls this. Test with a country your store ships to; the order still carries the flag `_ship_to_registry` so you can see it was meant for the registry owner (Admin > Registries > the registry > Delivery address). |
| Type check | `npm run typecheck` |
