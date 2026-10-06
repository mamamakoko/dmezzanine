# D-Mezzanine build plan (for Claude Code)

## Starting point (your `dmezzanine` folder, checked Oct 4, 2026)
- Laravel 12, PHP 8.2, Breeze with React + Inertia 2, Ziggy, Sanctum.
- Tailwind 3 (`tailwind.config.js`), but `@tailwindcss/vite` v4 is also listed in package.json. Remove one; keep Tailwind 3 to match Breeze.
- Database: SQLite (`database/database.sqlite`). Only the default users / cache / jobs migrations exist.
- Pages: Breeze defaults only (Login, Register, Dashboard, Profile, Welcome).

## Target versions
- **Laravel 13** (released March 17, 2026). It needs **PHP 8.3 or newer**; use PHP 8.4. Check with `php -v`.
- **MySQL 8.0+** (8.4 LTS recommended).
- Laravel 13 has no breaking changes from 12 for an app this new, so Stage 0 upgrades in place.

## How to use this file
1. Copy `design_handoff_dmezzanine/` into the root of `dmezzanine/`.
2. Open Claude Code in `dmezzanine/`.
3. Paste one stage prompt at a time. Run and test the app before moving on.
4. After each stage: `php artisan test`, then commit.

Every prompt assumes Claude Code has read `README.md` and `SYNC-AUDIT.md`; Stage 0 tells it to.

---

## Stage 0: Setup
```
Read design_handoff_dmezzanine/README.md, SYNC-AUDIT.md and PROJECT-NOTES.md. Don't write features yet.
0. Upgrade to Laravel 13: confirm PHP >= 8.3, set laravel/framework ^13.0 and phpunit/phpunit ^12.0 in composer.json, bump other packages to Laravel 13–compatible versions (inertia-laravel, sanctum, tinker, ziggy, breeze, pail, pint, sail, collision), run composer update, clear caches, and run the tests.
1. Switch .env to MySQL (DB_CONNECTION=mysql, database "dmezzanine"). Keep SQLite for tests in phpunit.xml.
2. Remove @tailwindcss/vite from package.json (we stay on Tailwind 3).
3. Install: composer require laravel/socialite laravel/reverb; php artisan reverb:install; npm i leaflet react-leaflet lucide-react.
4. Copy design_handoff_dmezzanine/prototypes/organic.css to resources/css/organic.css and import it in app.css after Tailwind. Map its tokens in tailwind.config.js theme.extend (colors bg, surface, text, divider, accent and accent-100..900, accent-2 ramp, neutral ramp; fontFamily body = Figtree; borderRadius 4px for buttons/inputs, md = var(--radius-md)).
5. Copy assets/logo.png to public/images/logo.png.
6. Remove the Register route and page. We don't allow self sign-up.
Summarise what you changed.
```

## Stage 1: Core data
```
Create migrations, models (with relationships, casts), factories and seeders for:
branches, roles, users (add role_id, branch_id, pin_hash, active, google_id), user_permission_overrides,
stock_items, categories, menu_items, branch_menu_items, recipes, addons, addon_menu_item, addon_parts, branch_addon_off,
payment_methods, payment_method_log.
Follow the schema outline in README.md. Every branch-scoped table gets branch_id with a foreign key.
Seed from the prototypes: the branches, the 32 stock items (STOCK0 in prototypes/Branch Menu.dc.html), MENU, CATS, RECIPE, the default add-ons and the 4 default payment methods per branch, plus demo users Rico (Owner), Marisol (Branch lead), Deng (Cashier). Password "dmezzanine", PIN 1234.
Write feature tests that the seeders run and relationships resolve.
```

## Stage 2: Sign-in and permissions
```
1. Google sign-in with Socialite: /auth/google and its callback. Accept only emails on our Workspace domain (config value), match against users, reject inactive users. Keep email/password login for local dev only (APP_ENV=local).
2. Till PIN unlock: POST /pos/unlock checks pin_hash for the current branch's staff.
3. Permissions: a Gate per area (pos, inventory, owner, sales, count), defaults by role from README "Roles and access", overridden by user_permission_overrides. Share the user's allowed areas to Inertia via HandleInertiaRequests.
4. Build Pages/Landing.jsx (workspace picker) to match prototypes/D-Mezzanine Landing.dc.html. Show only allowed apps. Exit asks for confirmation.
Write tests: each role sees only its apps, and a blocked route returns 403.
```

## Stage 3: The till (POS + Branch Menu)
```
Build one Till page (Pages/Till/Index.jsx) with an orderOnly prop.
- /pos renders it with orderOnly=false; /branch-menu with orderOnly=true (no prices, no payment; sends to the cashier).
Match prototypes/D-Mezzanine POS.dc.html: top bar, category tabs + search, tile grid, order panel, ticket picker 01–12, modifier sheet (size, milk, only add-ons the item offers and that are on at this branch), senior/PWD discount, Take payment.
Payment methods come from the branch's payment_methods. Follow the rules in README: cash quick amounts (exact, next ₱100, ₱500, ₱1,000), split rules, tab limit and lead-only.
Create orders, order_lines, order_line_addons, order_payments migrations. Saving an order is one DB transaction. Order numbers use a per-branch sequence; a ticket can't be reused while its order is open.
Port the Web USB thermal printing from the prototype into resources/js/lib/printer.js.
Tests: totals, VAT and senior discount, split payment sums, tab limit, ticket uniqueness.
```

## Stage 4: Back office
```
Inside the Till page, build the Inventory tabs to match the prototype: Dashboard, Menu (items, categories, availability per branch, photo upload to storage/app/public, recipe editor, which add-ons an item offers), Add-ons (Owner edits; Branch lead can only switch on/off for their branch), Till settings (payment methods for this branch only, with the change log), Stock (on hand vs par from branch_stock), Sales (receipts, split breakdown, unpaid tabs, by-method totals, refunds with manager PIN, PDF export).
Add refunds (or orders.refund_of). Enforce every rule in Laravel policies, not only in the UI.
Tests: a Branch lead can't edit another branch, only the Owner can edit add-on prices, at least one payment method stays on.
```

## Stage 5: Stock Count and Stock Report
```
Build Pages/StockCount.jsx and Pages/StockReport.jsx to match the prototypes.
Create stock_counts, stock_count_lines, branch_stock, branch_stock_items, stock_receipts.
"Used today" is a query, not stored: sum over paid orders for the branch and day of order_lines.qty × recipes (oat replaces milk, "No milk" removes it) plus addon_parts × qty. Put it in an App\Services\UsageService with tests.
Approving a sheet in the Stock Report writes branch_stock.on_hand (this is what the till shows).
```

## Stage 6: Marketing and Client map
```
Build Pages/Marketing.jsx to match prototypes/D-Mezzanine Marketing.dc.html. It shows the selected branch's available menu with no prices (API resources must not include price fields), an add-on picker, and sends to marketing_orders.
On the till: an inbox to accept or decline; accepted orders join the queue as unpaid; settling one records it as a paid order.
Build the Client map with react-leaflet to match prototypes/D-Mezzanine Client Map.html: clients, client_types (Owner manages the legend: name, preset or custom color), client_areas (circles with center + radius, one officer each), a client officer override, the officer filter, and branch pins moved only through "Change location".
Officers are users with the Marketing role.
```

## Stage 7: Warehouse Inventory and transfers
```
Build Pages/Inventory.jsx to match prototypes/D-Mezzanine Inventory.dc.html.
Create warehouse_stock, transfers, transfer_lines, deliveries, delivery_issues.
A branch requisition (from the till's Stock-in tab) must appear in Inventory; the statuses are Requested → Approved → In transit → Received. Receiving moves stock from warehouse_stock to branch_stock in one transaction. This was never connected in the prototype; see SYNC-AUDIT.md "Not synced yet" items 1–3.
```

## Stage 8: Sales reports and Owner console
```
Build Pages/Sales.jsx (trend, category, payment method from order_payments, top items, PDF) and Pages/Owner.jsx (users, roles, generate password/PIN, per-user permission overrides, branches) to match the prototypes.
```

## Stage 9: Live updates
```
Use Reverb + Laravel Echo (Laravel 13's Reverb database driver works without Redis). Broadcast on private branch channels: MarketingOrderSent, OrderStatusChanged (queue board), MenuAvailabilityChanged, StockCountApproved. Subscribe on the till, the queue and Marketing so they update without a reload.
```

## Before going live
- Replace the seeded SKUs, supplier names and prices with real ones (outstanding in PROJECT-NOTES.md).
- Set the Google OAuth client and Workspace domain in `.env`.
- Run `php artisan queue:work` and `php artisan reverb:start` under Supervisor.
- Back up MySQL nightly.
