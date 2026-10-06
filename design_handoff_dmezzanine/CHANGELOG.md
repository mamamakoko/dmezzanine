# Changelog — D-Mezzanine Cafe POS

- Client map: marketing officer areas. Owner draws circular areas (center + radius) and assigns an officer; clients inside go to that officer unless the client has its own officer. Officer filter, "Handled by" on rows and details, per-officer client counts. Stored in `dmz.clientAreas`; client `officer` field.

- Client map: Owner can manage the Legend (Edit on the legend) — add, rename, recolor (8 curated swatches) and remove client types. Renames carry over to existing clients; removing a type in use asks which type to move those clients to. Stored in `dmz.clientTypes`.

- POS + Branch Menu: settling a Marketing order on the queue now records its ingredients (recipe + add-ons × qty) to the branch's daily usage, once per order.

- Marketing: items that offer add-ons open an add-on picker (no prices) with quantity; cart lines are kept per add-on combination and sent with `addons`. POS/Branch Menu queue shows those add-ons and prices them at the till.

- Menu sync per branch (`dmz.menuByBranch`): POS and Branch Menu save each branch's menu + categories on edit and load them on branch switch; live-sync across open tabs. Marketing shows the selected branch's saved menu (available items only, its categories).

- POS + Branch Menu: ingredient usage is recorded once per order number (`dmz.usageSeen`), so a synced order is never counted twice whichever page records it.

- Branch Menu aligned with POS: reads the Owner-managed add-on list (only add-ons the item offers and that are on at the branch), stores milk/add-ons per line, and writes ingredient usage (recipe + milk swaps + add-ons × qty) to `dmz.usage` for the Stock Count "Used today" section. Sales records carry `pays`.

- Sales page: Payment method chart and PDF now split by each sale's `pays` (real method names, split parts counted under their own method, tabs shown as "(unpaid)").

- POS Sales: every sale stores `pays` [{method, kind, amt}] — split parts with amounts (cash change netted out), tabs under the real method name with `unpaid`/`tab`. Sales rows show split breakdown / unpaid tab; new "By payment method" totals for the current view; PDF export includes the breakdown.

- POS Till settings: payment methods are now fully per-branch — each branch has its own list, switches, details and change log. Owner or that branch's Branch lead can add, edit, remove and switch.

- POS: Payments tab is now **Till settings**. Methods × branches grid with on/off switches (Owner: all branches; Branch lead: own branch). Owner can add, edit and remove methods; each has a type (cash, card, QR, tab, other), till instructions, split eligibility, card terminal / wallets, and tab limit + who can open. Recent-changes log. Till enforces tab limit and lead-only rule.

- POS: new Inventory › Payments tab. Owner or Branch lead switches Cash, Card, E-wallet and Pay later on or off per branch; Take payment and split only show methods that are on.

Dated record of changes to the prototypes. Newest first.
Only entries below are verified; earlier work predates this log.

## 2026-10-02

### D-Mezzanine POS.dc.html
- Each paid order now records the ingredients it used, based on the item recipes, in `dmz.usage`, grouped by branch and day.

- Add-ons now have their own ingredients per serving, set in the add-on editor. Defaults: Extra shot uses 0.014 kg beans, Vanilla uses 0.03 btl vanilla syrup. When an add-on is ordered, its ingredients go onto the daily count too. Milk choice is also counted: Oat replaces fresh milk with oat milk, and No milk removes it.

### D-Mezzanine Stock Count.dc.html
- Ingredients used in today's orders are added to the daily count automatically, even if they aren't on the branch's usual list. A new "Used today" station is selected by default, and each of these rows shows a tag with how much the orders used. The sheet updates live as orders are paid.

## 2026-09-24

### D-Mezzanine POS.dc.html
- Added an "Add-ons" tab to the back office. The Owner can add, rename, reprice and remove add-ons, and choose which menu items offer each one. The list is stored in `dmz.addons` and shared by every branch.
- Each branch can switch an add-on off on its own till (for example when vanilla runs out). The Owner and Branch leads can do this, and the setting is stored per branch in `dmz.addonsOff`.
- The order dialog now shows only the add-ons that the item offers and that are switched on at the current branch. It skips the Add-ons group when none apply.
- The menu item editor now has an "Add-ons offered" section, shown when "Ask for size, milk and add-ons" is on. The Owner assigns add-ons there, and the assignments stay in sync with the Add-ons tab.

### D-Mezzanine Marketing.dc.html
- Removed all prices from Marketing: menu tiles and the item sheet no longer show money. Pricing stays in the POS.
- Added a "Client map" tab. Staff can drop a pin (by clicking the map or searching an address) for each past client and record their name, type (Event, Corporate, Catering, Regular), contact, serving branch, last order date and notes. Pins can be edited, dragged and deleted, and the list can be searched and filtered by type. Branches are shown as fixed markers.

### D-Mezzanine Client Map.html (new)
- Branches come from the branch list in the CEO page (`dmz.branches`). A newly added branch shows up in a "not on the map yet" note, and the Owner can click "Place pin" to set its location. Its coordinates are saved on the branch record as `lat`/`lng`. Branch markers are fixed. Clicking a branch marker opens its details: status, address, manager, staff, clients served and last client order. From there the Owner can choose "Change location" and click the new spot.
- Leaflet + OpenStreetMap page shown inside the Marketing tab. Clients are stored in `dmz.clients` (localStorage) until a `clients` table exists in Supabase/Laravel. None exists in the codebase yet.

## 2026-09-21

### D-Mezzanine Marketing.dc.html
- Removed the mock "Who is signing in?" account picker.
- Removed the 4-digit PIN pad entirely. The entry card now confirms who is signed in and offers a single "Start taking orders" button.
- Wired the page to the main system session (`dmz.session` in localStorage): a user signed in on the Landing page carries straight into Marketing, and the header, greeting and "sent by" all follow that real user.
- Added a permission gate. Marketing access follows role (Owner and Branch lead by default) plus any per-user override in `dmz.perms`. Users without access see an explanation and a link back to the main system; with no session at all, a prompt to sign in first.
- Removed "Mode of payment" from the order panel, the send-confirmation summary and the Sent orders meta line. Payment is taken at the branch till.
- Menu items now use the POS tile card: photo tile, name, note, price, cart-count badge, and a "?" that opens an item sheet with photo, price, category and branch availability.
- Item photos read the same `dmz.menuphotos` store the POS Menu manager writes, refreshed every few seconds.
- Item prices now match the POS price list exactly.

### Cross-file
- Aligned the payment-method field name between Marketing, Branch Menu and POS so marketing orders display correctly at the till (superseded for Marketing by the payment removal above).

## Notes
- Not yet carried into Marketing: ingredient/recipe breakdown and the low-stock tag (Marketing holds no stock state).
- Google Sign-In is still a prototype mock; see `CLAUDE.md` for the deployment plan.
