# D-Mezzanine: sync audit before the Laravel + React + MySQL build
Audited Oct 3, 2026. In the prototypes, "synced" means shared browser storage between pages. In the real build, every shared item becomes a MySQL table behind a Laravel API.

## Fixed in this pass
- POS stock on hand now reads the approved count sheet (same as Branch Menu and Stock Count) and reloads after an approval.
- POS stock list now matches Branch Menu and Stock Count (32 warehouse SKUs; before this it had 17).
- Recipes are shared between POS and Branch Menu, so ingredient usage is the same whichever till records the order.
- Refunds now reach the Sales page (before this they only showed in the till's own Sales tab).

## Synced across pages
| Data | Written by | Read by | MySQL table(s) |
|---|---|---|---|
| Session / user | Landing | all pages | `users`, sessions (Google ID token, see CLAUDE.md) |
| Role permissions | CEO | all pages | `roles`, `role_permissions` |
| Branches | CEO, Client Map | all pages | `branches` |
| Menu + categories (per branch) | POS, Branch Menu | Marketing | `categories`, `menu_items`, `branch_menu_items` (avail) |
| Menu photos | POS, Branch Menu | Marketing | `menu_items.photo_path` (file storage) |
| Recipes | POS, Branch Menu | – | `recipes` (menu_item_id, stock_item_id, qty) |
| Add-ons + which items offer them | POS, Branch Menu | Marketing | `addons`, `addon_menu_item`, `addon_parts` |
| Add-on off per branch | POS, Branch Menu | Marketing | `branch_addon_off` |
| Payment methods (per branch) | POS | – | `payment_methods` (branch_id, kind, split, limit, lead_only…), `payment_method_log` |
| Orders / sales | POS, Branch Menu | Sales, Stock Report | `orders`, `order_lines`, `order_line_addons`, `order_payments` |
| Refunds | POS | Sales | `refunds`, `refund_lines` (or orders with `refund_of`) |
| Order numbers | POS, Branch Menu | – | auto-increment / per-branch sequence |
| Marketing orders (inbox) | Marketing, POS, Branch Menu | – | `marketing_orders`, `marketing_order_lines` |
| Ingredient usage per day | POS, Branch Menu | Stock Count | derive from `order_lines` + `recipes` + `addon_parts` (SQL view), no stored copy |
| Count sheets, review, approved on-hand | Stock Count, Stock Report | POS, Branch Menu | `stock_counts`, `stock_count_lines`, `branch_stock` |
| Items carried per branch | Stock Count | Stock Report | `branch_stock_items` |
| Received stock | Stock Count | Stock Report | `stock_receipts` |

## Not synced yet (prototype only; build these as shared tables)
1. **Transfers and requisitions between branches and the warehouse.** The POS branch side and the Inventory warehouse side each use their own sample data, so a requisition raised at a branch never appears in Inventory. Tables: `transfers`, `transfer_lines`, statuses Requested, Approved, In transit, Received.
2. **Delivery issues and stock-in (receiving).** Kept in the POS's working memory only and lost on reload. Tables: `deliveries`, `delivery_issues`.
3. **Warehouse stock in Inventory.** It has its own sample data and isn't connected to branch stock or transfers. Table: `warehouse_stock`, moved by transfers.
4. **Queue board status (Preparing, Ready, Served).** Each till keeps its own; only Marketing orders share status. Columns: `orders.status` with live updates (Laravel Echo or polling).
5. **Client map pins and legend.** Saved in the browser only. Tables: `client_types` (name, color, sort), `client_areas` (name, officer_user_id, center lat/lng, radius_m), `clients` (client_type_id, officer_user_id nullable override, contact, lat/lng, serving branch, notes).
6. **Two sales records.** Every order is written twice: one detailed copy (`dmz.sales`) and one for the till queue (`dmz.orders`). In MySQL this becomes the single `orders` table.
7. **Branch Menu still has its own copy of the till code.** In React, POS and Branch Menu should be one till component with an "order-only" mode, so they can't drift apart again.

## Notes for the build
- Make the usage count (orders × recipes × add-ons) a query or view, not a stored running total. The prototype's "count each order once" guard then isn't needed.
- Prices live only on the server and the till. Marketing endpoints should never return price fields.
- Branch scope: every branch table has a `branch_id`. Enforce Owner / Branch lead / Cashier in Laravel policies, not just in the UI.
- Outstanding (from CLAUDE.md): real SKU codes, supplier names and prices.
