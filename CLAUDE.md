# CODE-MATCHA — LINE ordering system

Matcha café (owner "Dew", non-developer, **reply in Thai**). Customers order and pay inside LINE; the barista runs the shop from `/admin`.
Shop name is **CODE-MATCHA** (with T). The repo folder `code-macha` and the Desktop folder "CODE-MACHA QR" keep the old spelling; that's fine.

## Stack & links
- Next.js 15 App Router + TypeScript, no UI library. All CSS lives in one global file, `app/globals.css`.
- Supabase: Postgres plus Storage buckets `slips` (private) and `promo` (public). The service-role key is used **server-side only**. RLS is on with no policies.
- LINE: LIFF `2011734262-vT6PURmn`, Login channel `2011734262`, Messaging channel `2011734053`, OA `@745plqxi`. Rich menu `richmenu-8aef16dcb224457b29352dcf1fe946db`; its `chatBarText` is limited to 14 characters.
- Hosting: Vercel, region sin1. Push to `main` on github.com/iDEWKRUB/code-matcha and it auto-deploys to https://code-matcha.vercel.app (`/admin`, `/member`, `/poster`).
- Payment: PromptPay EMV QR generated in `lib/promptpay.ts`. The customer uploads a slip and the barista confirms it by hand.
- Secrets live only in `.env.local` (gitignored) and in Vercel env vars. Never print them or commit them.

## File map
- `app/page.tsx`: customer order page (LIFF). Not prettier-formatted, so **don't run prettier on it** (it rewrites about 400 lines).
- `app/member/page.tsx`: member card (tiers, points, gifts, coupons, invite-a-friend).
- `app/poster/page.tsx`: A5 scan-to-order poster.
- `app/admin/`:
  - `Board.tsx`: sidebar, 5 s polling, new-order alarm (sound logic in `alarm.ts`).
  - Tabs: `OrdersTab`, `MenuTab` (sold-out and show/hide switches), `ReportTab` (sales + visitors), `CostTab` (+ `PowderPanel`), `SettingsTab` (shop / menu / promo / members / LINE).
- Art components: `app/*Art.tsx`, `Cup.tsx`, `Food.tsx`, `MatchaTin.tsx`, `Loader.tsx`. Icons: `app/Icon.tsx`, line icons only (**no emoji in the UI**).
- `lib/`:
  - `menu.ts`: types and pricing (`linePrice` / `lineDetail`; powder surcharge = per-gram rate × menu grams, rounded to ฿5).
  - `orders.ts`: DB reads, `MENU_COLUMNS`, `getPowders`.
  - `line.ts` / `flex.ts`: push and Flex cards (`flex.ts` is server-only).
  - `member.ts`, `referral.ts`, `costs.ts` (client-safe math), `costsServer.ts`, `config.ts` (points, tiers, referral).
- `app/api/`:
  - Public: `menu`, `orders`, `member`, `track`, `promo`, `line/webhook`, `qr`.
  - Admin: everything under `admin/*`, guarded by `isAdmin()`.
- `supabase/`: `schema.sql` + `migration-002 … 018` (**all run**). The owner runs SQL by hand in the SQL Editor; we have no DDL access.
- `scripts/import-pos-costs.mjs`: one-off import from the old POS artifact.

## Working rules
- **A new DB column needs a new `migration-0NN-*.sql`, and the owner must run it BEFORE we push.** Code that selects a missing column breaks `/api/menu` for customers. Commit locally, wait for "รันแล้ว", verify the column with a small node script, then push.
- Before adding a CSS class, grep `globals.css` for it. `.mcard` once clashed and broke the admin menu (the member card is now `.mbcard`).
- Testing:
  - Run `next dev` with `NEXT_PUBLIC_LIFF_ID=` empty and use the `Bearer dev` token.
  - Take screenshots with headless Edge over CDP (minimum width about 500 px).
  - Test against real data only with separate `TEST` rows, and delete them in `finally`. Never write onto rows the owner uses.
  - On the customer page, block `/api/track` so the test doesn't count as a visitor.
- Windows:
  - Refresh PATH in PowerShell before running git/node, and push with `GCM_INTERACTIVE=always`.
  - `Set-Content -Encoding utf8` adds a BOM; use Edit/Write or sed instead.
  - Long bash heredocs sometimes fail; use the Write tool.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Done
- **Ordering:**
  - Drinks and food with options: temperature, sweetness, milk, powder grade by grams, ice separate/not, per-menu toppings switch, food option groups.
  - Services: pickup slots, dine-in (table), takeaway.
  - Shop hours and open/closed switch; promo codes; points (฿25 = 1 pt, 1 pt = ฿1, min 50); PromptPay + slip upload.
- **LINE:**
  - Friend required before ordering.
  - Flex cards for every status change, rich menu commands, broadcast with template image generator, message log.
- **Members:**
  - Card with tiers Culinary / Premium / Ceremonial.
  - Gifts in 2 categories (menu / premium merch, with photo or cartoon), 6-character coupons redeemed at the counter.
  - Invite-a-friend: 20 + 20 points on the friend's first paid order.
- **Admin:**
  - Kanban orders with a loud repeating alarm until "รับทราบ".
  - Menu sold-out and show/hide switches, plus bulk hide.
  - Sales report (day / week / month) with visitor count and funnel.
  - Cost & profit (ingredient library with pack pricing and photos, per-menu recipes, per-powder margin matrix, delivery GP pricing: LINE price vs app price).
  - Settings.
- **Brand files:** logo, stickers, poster, rich menu image (sources in the session scratchpad `logo/`).

## Pending / owner to-do
- LINE side (owner does these):
  - Rename the OA display name and the LIFF / Login channel name to CODE-MATCHA.
  - Turn on `shareTargetPicker` in the LIFF settings.
  - Turn off the OA Manager greeting.
- Set `ADMIN_PASSWORD` in Vercel to match `.env.local`.
- Link "ผงมัทฉะทั่วไป" to a cost item. Add milk to the latte recipes, and recipes for the 5 menus that have none. Some matcha menus have no `matcha_grams` yet.
- Merge the rest of the old POS (artifact `b020fd2a-…`): walk-in cashier screen, profit in the sales report, phone-based members.
- Vercel Hobby doesn't allow commercial use; consider Pro.

## Plan: มาม่าบาร์ (draft, not started)
Goal: customers at the shop pick noodles and toppings onto a tray, scan, and pay without queuing at the counter.
1. **In-store mode**: a customer-page mode for people already at the shop (like today's `dine_in`, but no time slot). Open it with `?mode=store`, from a QR at the bar, with a large and simple UI.
2. **Tray scan**: each tray has its own QR (`?tray=12`). Scanning it attaches the order to that tray number (instead of a table number) so the barista knows which order to bring back. It could reuse `table_no` or get a new `tray_no` column (needs a migration).
3. **PromptPay**: use the existing QR + slip flow. Maybe add an in-store "pay at the counter" option.
- Probably needs a new `kind` (e.g. `noodle`) with option groups, reusing the food `toppings[].group` system; costs through the existing cost tab.
- **Open questions for the owner:**
  - Does "scan tray" mean scanning a QR on the tray, or scanning the items on the tray?
  - Pay before or after eating?
  - Is the tray number needed for delivering food back?
  - Mama bar menu and prices.
