# D-Mezzanine Cafe — project notes

## Google Sign-In (deployment plan)
The account picker in `D-Mezzanine Admin.dc.html` is a **prototype mock** built from the demo users. On real build:

- Remove the mock "Choose an account" panel entirely.
- Use Google Identity Services (GIS) on the login page — Google's own hosted chooser, not a styled in-app list.
- Laravel verifies the returned ID token server-side, matches the email against the `users` table, checks role and active status, then issues the session.
- Restrict sign-in to the dmezzanine workspace domain.

## Stack context
- Backend: Laravel app (`dmezzanine`), Supabase schema to sync with.
- Prototypes: `D-Mezzanine Admin.dc.html` (back office), `D-Mezzanine POS.dc.html` (till).
- Demo accounts (prototype only): Rico, Marisol, Deng — password `dmezzanine`.

## Visual language
Organic design system. Figtree semibold headings, 4px radii, charcoal surfaces, terracotta reserved for primary actions only, tabular figures for all numeric columns.

## Outstanding
Real SKU codes, supplier names and prices; Supabase schema integration.
