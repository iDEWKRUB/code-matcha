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

## มาม่าบาร์ self-service: BUILT, hidden (2026-09-29, commit 9c475c2, migration 019 run)
- Customer page `/bar` (open via `liff.line.me/<liffId>/bar`). There is no customer-facing button yet; the owner will wire one later. `noindex`.
- Files:
  - `app/bar/page.tsx`: 4 screens.
  - `app/bar/scan.ts`: zxing-wasm reads every QR in one tray photo. The wasm is self-hosted at `public/zxing_reader.wasm`; keep it in sync with the pinned `zxing-wasm` version.
  - `lib/bar.ts`, `lib/barServer.ts`: `checkSlip` calls SlipOK.
- APIs:
  - `/api/bar`, `/api/bar/orders`, `[id]`, `[id]/slip`.
  - Admin: `/admin/bar` (items + A4 QR sticker sheet), `/api/admin/bar`.
- DB:
  - Table `bar_items`.
  - `orders.source` (`menu` | `bar`); `orders.slip_ref` is unique.
  - QR payload is `CMB1:<bar_item_id>`.
- Slip flow:
  - SlipOK pass → order goes straight to `completed` and earns points (no board alarm).
  - Fail, or no key set → `payment_review`. The barista's confirm button moves bar orders straight to `completed`.
- Env: `SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID` are set in Vercel (not in `.env.local`). Prices are placeholders; the owner edits them at `/admin/bar`.
- SlipOK was verified on a real slip (2026-09-29).
- Evidence (migration 020, commit d9a4b46):
  - Each bar order stores `tray_path` (private bucket `trays`, signed URLs, purged after 90 days by `purgeOldTrays` when the admin opens bills).
  - It also stores `bar_scan` {detected, unknown, declared, final}, `terms_at`/`terms_version`, and `bar_extra`/`bar_extra_note` (back-charge record).
  - Ordering requires a live camera photo (no album option), the customer's own item count, and both `TERMS` ticked.
  - `barFlags()` in `lib/bar.ts` flags suspicious bills.
  - Customer history: `/api/bar/history`. Shop view: `BarBills` in `/admin/bar`, API `/api/admin/bar/orders`.
- Home: CODE-MATCHA header + mini how-to (no matcha section or bottom nav). Loader: `app/bar/BarLoader.tsx`.
- Back-charge (migration 021, commit d375a5c): `bar_extra_items`/`bar_extra_status` (none|due|review|paid).
  - Shop picks the unpaid items in `BarBills` (prefilled from detected−final).
  - The PATCH `action: send` pushes a Flex card with the tray photo (30-day signed URL) linking to `/bar?extra=<id>`.
  - The customer pays via `/api/bar/orders/[id]/extra`: SlipOK → paid, else review → shop confirms.
- Extra-paid thank-you card: `notifyExtraPaid` in `lib/barServer.ts`. The bills UI (`BarBills`) has tiles, filters, and a detail drawer with a 4-step timeline.
  - Timeline state classes are `bbs-*` because `.done` and `.sum` clash globally.
- Stock (migration 022, commit 8bb8ced):
  - `bar_items.stock`, table `bar_stock_moves` (in/sale/count), table `bar_counts` (closing counts, lines with diff/waste).
  - RPC `bar_stock_set_order` (idempotent per order) and RPC `bar_stock_add`.
  - `applySale()` runs when a bar bill is paid (SlipOK path + admin confirm).
  - Back-charge items do NOT move stock: they left at pick time; the count shows the loss and the trace attributes it.
  - UI `app/admin/bar/BarStock.tsx`, API `/api/admin/bar/stock` (GET overview/trace, POST in/count/waste).
  - The customer scan page shows a red `.nb-alert` notice before paying. Per-item stock that is cut automatically on sale, "รับของเข้า", and a closing count showing the variance vs sold.

- Merged into the main system (migration 023): shop_settings `bar_enabled` (default off), `bar_open_time`/`bar_close_time` (close < open = overnight), `bar_all_day`.
  - `getBarHours()` in `lib/barServer.ts`; bar ordering uses these hours, not the matcha hours.
  - Customer: `/api/menu` returns `bar` only when enabled → `.bar-entry` card on `app/page.tsx`. `/bar` still works via the link when off (shows a test-mode note).
  - Admin: "มาม่าบาร์" tab in `Board.tsx` renders `<BarAdmin embedded/>` with `BarHoursPanel` (API `/api/admin/bar/hours`).
- Idea only (not built): "pay at counter" option during staffed hours.

### Original plan (for reference)
Design: https://claude.ai/artifact/P429zSsnvHE1htYp7gAjmm (canvas "CODE-MACHA × มาม่า Self-Service", 4 phone screens, palette cream #F3EFE4 / matcha #2F4A2A / seal red #B8412C).

**Owner's constraints:**
- Use the existing LIFF stack.
- Keep the current version working.
- Customers must not see any of this until the owner says so. Build it behind a switch or a hidden entry (e.g. only via `?mode=store`, or a `shop_settings` flag that is off by default).

**Flow from the design:**
1. **Home, in-store mode**: toggle "สั่งกลับบ้าน / ส่ง" | "อยู่ที่ร้าน". A dark green card "มาม่าบาร์ บริการตัวเองทั้งร้าน" with 3 steps (วางบนถาด → ถ่ายรูปสแกน → จ่าย & ต้มเอง) and a "เริ่มสแกนถาด" button. Below it, "มัทฉะที่บาร์" (normal drinks). A bottom nav with a big red center scan button.
2. **Scan tray**: every product (noodle pack, topping cups: กุ้ง / หอย / ปู …) carries its **own QR sticker**. The customer takes **one photo of the tray** and every QR is read at once (the same code twice = qty 2). Show "อ่าน QR ได้ N ชิ้น · วางไม่ซ้อนกันนะ", then a "รายการในถาด" list with +/- and a "ไปชำระเงิน ฿total" button.
3. **Pay**: existing PromptPay QR with the amount + slip upload. The design says "ระบบตรวจยอดให้อัตโนมัติ", but we only have manual slip checking; auto-verify would need a paid slip API (e.g. SlipOK). Ask the owner.
4. **Done**: "ชำระเรียบร้อย ไปต้มได้เลย", cooking steps (เส้นลงถ้วย เติมน้ำร้อนถึงขีด → ใส่ท็อปปิ้ง ปิดฝารอ), a "เริ่มจับเวลา" timer, an upsell card "คู่กับมัทฉะเย็นสักแก้ว?", points / stamp card.

**Build sketch (proposal):**
- Migration: allow `menu_items.kind = 'bar'` (currently `('drink','food')`) and seed the bar items hidden. QR payload e.g. `CMB1:<menu_item_id>`.
- `lib/menu.ts`: `Kind` gets `bar`; `linePrice` is price × qty with no options.
- Order API: accept bar lines; orders stay `service = dine_in` (table optional), so no service migration.
- Reading many QRs from one photo:
  - Use `<input type=file capture>` (works in the LINE in-app browser).
  - Try `BarcodeDetector` first (returns all codes where supported).
  - Fall back to `jsqr` in a loop: decode, white-out the found code, decode again.
  - Always offer "เพิ่มเอง" manual add. Optional extra: `liff.scanCodeV2` one code at a time.
- Admin:
  - Kind "มาม่าบาร์" in the menu editor.
  - Cartoon art for noodle / topping.
  - A printable QR sticker sheet page for bar items.
  - Bar items get costs through the existing cost tab.

**Open questions:**
- Real mama bar menu and prices (the design has placeholders).
- Should customers cook before the slip is confirmed?
- Auto slip check: **decided, SlipOK** (owner has an account, branch "Code matcha" #77223, 2026-09-29). Use it for the mama bar only, built together with it; don't add it to the current order flow yet. API: `POST https://api.slipok.com/api/line/apikey/<branchId>` with header `x-authorization: <key>`. Put the key in `.env.local` + Vercel as `SLIPOK_API_KEY` / `SLIPOK_BRANCH_ID`; the owner adds it themselves, never in chat.
- Keep the name CODE-MATCHA in the new UI (the design still says CODE-MACHA).
