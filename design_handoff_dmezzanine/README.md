# Handoff: D-Mezzanine Cafe system (POS, back office, marketing, stock)

## Overview
D-Mezzanine is a café chain in Camarines Sur (branches such as DMC-Iriga and DMC-Naga, plus a warehouse in Iriga and a commissary). This bundle describes the whole operations system: the branch till (POS), order-only branch menu, marketing order taking and client map, warehouse inventory, daily stock count and stock report, sales reporting, and the Owner console for users and permissions.

Target stack: **Laravel 13 (PHP 8.3+) + React via Inertia + MySQL 8**.

## About the design files
The files in `prototypes/` are **design references built in HTML**. They show the intended look, copy and behavior, but they are not production code. Recreate them in React inside the Laravel app, using its routing, state and data-fetching patterns. All data in the prototypes lives in browser `localStorage` under `dmz.*` keys. In the real build each key becomes a MySQL table behind a Laravel API. `SYNC-AUDIT.md` maps every key to its table and lists what was never shared between pages.

To open a prototype, serve the `prototypes/` folder from any static server and open a `.dc.html` file. Demo sign-in accounts are listed under "Auth" below.

## Fidelity
**High fidelity.** Colors, type, spacing, copy and interactions are final. Recreate the UI to match, using the Organic tokens below.

## Roles and access
| Role | POS | Inventory | Owner console | Sales | Stock count |
|---|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ |
| Branch lead | ✓ | – | – | ✓ | ✓ |
| Cashier / Staff | ✓ | – | – | – | – |
| Warehouse / Commissary | – | ✓ | – | – | – |

- The Owner can override any of these per user in the Owner console (prototype key `dmz.perms`, keyed by email). Enforce them in **Laravel policies**, not only in the UI.
- Owner-only actions: edit the add-on list and prices, change which items offer an add-on, move branch pins on the client map.
- Branch lead or Owner: switch add-ons on or off at a branch, and manage that branch's payment methods.

## Auth
- The prototype uses a mock account picker. In production use **Google Identity Services** (Google's hosted chooser). Laravel verifies the ID token server-side, matches the email to `users`, checks role and active status, then issues the session. Restrict sign-in to the dmezzanine Workspace domain. Details are in `PROJECT-NOTES.md`.
- Till staff unlock the POS with a 4-digit PIN. The Owner console generates passwords and PINs.

## Screens

### 1. Landing (`D-Mezzanine Landing.dc.html`)
Sign-in, then a workspace picker. It shows only the apps the user's role allows: POS, Inventory, Owner console, Sales, Stock count. Exit asks for confirmation; the user stays signed in.

### 2. POS: branch till (`D-Mezzanine POS.dc.html`)
- **Top bar:** logo, branch name, Till / Queue / Inventory tabs, Marketing inbox, clock, Connect printer (Web USB thermal printer, ESC/POS), Exit with confirmation.
- **Till:** category tabs and search on the left, menu tile grid in the middle, order panel on the right. The order panel has Dine-in / Takeout, a ticket number picker (01–12, open tickets faded), lines with qty steppers, senior/PWD discount (VAT-exempt + 20%), a note, and Charge.
- **Modifier sheet** for items with `mods`: Size, Milk (Fresh, Oat +₱20, Skim, No milk), and Add-ons. It shows only add-ons the item offers that are switched on at this branch.
- **Take payment:** amount due, then payment method buttons, which come from the branch's own payment methods (see Till settings).
  - **Cash:** quick amounts are the exact amount plus the next ₱100, ₱500 and ₱1,000 bill amounts, then free entry and change due.
  - **Card / QR / Other:** show the method's instructions, then Mark as paid.
  - **Tab (pay later):** asks who the tab is charged to, and enforces the method's limit and lead-only rule.
  - **Split payment:** uses only methods with "can be split". Any overpayment must include cash, and the change comes off the cash part.
- **Receipt:** printable; sent to the thermal printer if one is connected.
- **Queue:** order cards that move Preparing → Ready → Served. Marketing orders accepted from the inbox appear here as unpaid until settled. Settling a Marketing order records its ingredient usage.
- **Inventory (back office), left tab list:**
  - **Dashboard:** low stock, incoming transfers, open delivery issues, stock value.
  - **Menu:** categories plus items (name, price, category, note, "ask for size/milk/add-ons", available toggle, photo, recipe). This is also where the Owner picks which add-ons an item offers.
  - **Add-ons:** the Owner's list (name, price, ingredients per serving, items that offer it). The branch on/off switch belongs to the branch.
  - **Till settings:** payment methods **for this branch only**. Each one has an on/off switch, Edit and ×, plus New method. Fields: name, type (cash, card, QR/e-wallet, tab, other), till instructions, can be split, card terminal, wallets accepted, tab limit, and who can open a tab (any cashier, or Branch lead / Owner). At least one method must stay on. A Recent changes log shows who changed what and when.
  - **Stock:** on hand vs par. On hand comes from the last approved count.
  - **Stock-in:** receiving, plus requisitions and transfers (inbound / outbound).
  - **Sales:** receipts with search and date range, the split breakdown, unpaid tabs, by-payment-method totals, refunds (manager PIN, per line), and PDF export.

### 3. Branch Menu (`Branch Menu.dc.html`)
The same till in **order-only mode**: no prices and no taking payment. It sends the order and ticket to the cashier. In React, build POS and Branch Menu as **one till component with an `orderOnly` flag**, not two copies.

### 4. Marketing (`D-Mezzanine Marketing.dc.html`)
- **Who:** marketing agents take bulk and event orders for a chosen branch.
- **Prices:** none are shown anywhere on this screen; the till applies them on arrival. Marketing API responses must never include price fields.
- **Menu:** the selected branch's menu, available items only, in that branch's categories. Items that offer add-ons open an add-on picker with quantity, and cart lines are kept per add-on combination.
- **Sending:** the order goes to the branch inbox with customer, phone, address, wanted date/time, service and note. The branch accepts or declines from its till.
- **Client map** (`D-Mezzanine Client Map.html`): pins for past clients (type, contact, serving branch, notes). Branch pins aren't draggable; the Owner uses **Change location** and then clicks the new spot. The Owner manages the **Legend** (client types): add, rename, recolor from 8 curated colors, and remove. Renames carry over to existing clients, and removing a type that's in use moves its clients to another type. **Areas:** the Owner draws circular areas (center + radius slider) and assigns each a marketing officer. A client's officer is its own override if set, otherwise the smallest area containing it. The sidebar filters by officer and shows "Handled by". Officers should come from users with a Marketing role.

### 5. Inventory: warehouse (`D-Mezzanine Inventory.dc.html`)
Warehouse and commissary stock, recipes and costing, approving and dispatching requisitions, transfers, deliveries and the shopping list. **Not yet connected to the branch side.** Build it on shared `transfers` tables.

### 6. Stock Count (`D-Mezzanine Stock Count.dc.html`)
- **Sheet:** a daily count sheet per branch, with each item's ending count and a "Used today" section.
- **Used today:** calculated from paid orders (recipe × qty, oat milk replacing fresh, "No milk" removing milk, plus add-on ingredients × qty).
- **Submitting:** staff submit the sheet, and the manager reviews it in the Stock Report.

### 7. Stock Report (`D-Mezzanine Stock Report.dc.html`)
Manager review of the submitted sheets: variance, approval, and received stock. Approving sets the branch's **on hand**, which is what the POS shows.

### 8. Sales (`D-Mezzanine Sales.dc.html`)
Reporting across branches: daily trend, category, payment method, top items and a PDF report. Payment method totals use each sale's `pays` breakdown, so split parts count under their own method and tabs appear as "(unpaid)".

### 9. Owner console (`D-Mezzanine CEO.dc.html`)
Users (role, location, active, password and PIN generation), per-user page permission overrides, and branches.

## Key business rules
- **Ingredient usage:** count each order once, when it is paid (or settled, for Marketing orders and tabs). In MySQL, derive usage with a query or view over `order_lines × recipes × addon_parts` rather than keeping a running total.
- **Branch independence:** each branch has its own menu (availability and categories), add-on on/off, payment methods and stock. Recipes and the add-on list are shared across branches.
- **Refunds:** a refund is a negative entry tied to the original sale (`refund_of`), with a reason and method. It needs a manager PIN and works per line and quantity.
- **Ticket numbers:** 01–12 per branch; a ticket can't be reused while its order is open.
- **VAT:** 12% included in prices. The senior/PWD discount removes VAT, then takes 20% off.
- **Order numbers:** share one sequence across the tills of a branch.

## Proposed MySQL schema (outline)
`users, roles, role_permissions, user_permission_overrides, branches, categories, menu_items, branch_menu_items(branch_id, menu_item_id, available, sort), recipes(menu_item_id, stock_item_id, qty), addons, addon_menu_item, addon_parts, branch_addon_off, payment_methods(branch_id, name, kind, split, note, terminal, wallets, tab_limit, lead_only, active), payment_method_log, orders(branch_id, no, ticket, service, status, cashier_id, gross, discount, vat, total, unpaid, tab_name, refund_of, created_at), order_lines, order_line_addons, order_payments(order_id, payment_method_id, amount), marketing_orders, marketing_order_lines, client_types, client_areas, clients, stock_items(sku, name, unit, cat, cost, par), branch_stock(branch_id, stock_item_id, on_hand, counted_on, counted_by), stock_counts, stock_count_lines, stock_receipts, warehouse_stock, transfers, transfer_lines, deliveries, delivery_issues`

The data each of these replaces is listed in `SYNC-AUDIT.md`.

## Real-time
Several pages update live in the prototype via the browser `storage` event: the Marketing inbox reaching tills, menu and recipe changes, and approved counts reaching the POS. Use **Laravel Reverb or Pusher with Echo**, or short polling, for: the inbox, the queue board, branch menu availability, and count approvals.

## Design tokens (Organic design system, `prototypes/organic.css`)
- **Colors**
  - Surfaces and text: bg `#f5ead8`, surface `#ebddc5`, text `#201e1d`, divider = text at 16%.
  - Neutrals: 100 `#f9f4ed`, 200 `#eee7db`, 300 `#dcd3c4`, 800 `#474238`, 900 `#2e2b25` (charcoal top bars and sidebars).
  - Accent (terracotta, **primary actions only**): `#c67139`. Scale: 100 `#fff2eb`, 200 `#ffe1d0`, 300 `#ffc6a5`, 400 `#f6a06b`, 500 `#d67f48`, 600 `#b2622d`, 700 `#8c491a`, 800 `#643312`, 900 `#402310`.
  - Accent 2 (sage, for on / ok states): `#7a8a5e`. Scale: 100 `#f0fae1`, 200 `#e1eecc`, 300 `#ccdbb2`, 500 `#8fa073`, 700 `#56633f`, 900 `#272e1b`.
- **Type:** Figtree for body and UI. Headings use Figtree semibold (600), letter-spacing −0.012em. Use tabular figures for every numeric column and amount. Section labels are 11.5px uppercase with 0.08em tracking, in text at 74% opacity.
- **Radii:** buttons and inputs 4px; cards `--radius-md` 16px; small 8px.
- **Spacing:** 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2px.
- **Shadows**
  - sm: `0 1px 2px` #2e2b25 at 14%
  - md: `0 3px 10px` at 16%
  - lg: `0 12px 32px` at 22%, used for sheets and modals
- **Modals:** charcoal scrim at 45%, max-width 380–600px, padding 26px 28px, and a 160ms ease-out entrance.
- **Touch targets:** at least 44px on till screens.

## Assets
- `assets/logo.png`: the D' Mezzanine logo.
- Menu photos are uploaded by staff from the Menu tab (stored as data URLs in the prototype; use file storage in production).
- No other imagery.

## Files
- `prototypes/`: all screens listed above, plus `support.js` (the prototype runtime only, not needed in the build), `organic.css` and `image-slot.js`.
- `SYNC-AUDIT.md`: storage keys → tables, and what isn't shared yet.
- `CHANGELOG.md`: feature history and decisions.
- `PROJECT-NOTES.md`: project notes, auth plan and outstanding items (real SKU codes, supplier names and prices).
