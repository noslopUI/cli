---
name: noslopui
description: Build a stunning, non-generic UI using noslopUI's hand-crafted catalog over MCP — either from a collection the user curated themselves, or by choosing one Design System and applying it consistently across every component. Use when asked to build a landing page, dashboard, marketing site, or any new page/section from scratch, when the user mentions a noslopUI collection, or when a UI you're building looks like "AI slop" (gradient text, purple-on-purple, bounce easing, everything centered) and needs a real design system instead.
---

# noslopUI

You have access to the **noslopUI MCP server** — a catalog of hand-crafted (not
AI-generated) UI components, full page examples, and portable Design Systems.

## The rules

1. **Choose one design system before fetching any component, then restyle every component to it** — colours, type scale, spacing, radius, motion. One system applied everywhere is what stops a multi-page build reading as a collage.
2. **Search the whole catalog on fit.** A design system is a set of rules, not an inventory of parts: any component can be built in any system, so nothing is off-limits once one is chosen.
3. **Never substitute a catalog component for one the user explicitly saved** in a collection. Their pick was a decision, not an oversight.
4. **Ask about their brand before building** — logo, brand colours, typeface, real photography. Put their values into the system's tokens (their colour replaces `accent`) and keep the system's rules.
5. **Check for a collection first:** call `list_collections`. If one fits the request, build from it. If none fits, or no key is configured, don't guess a collection — shortlist two or three design systems with `search_design_systems` and let the user pick.
6. **If a gated tool says the trial has ended or the fair-use limit is reached, tell the user and stop** — don't retry, and don't swap in something generated from scratch.

Setup, if a tool says no key is configured: the user creates an API key at
`noslopui.com/account` (MCP tab) and adds it to this MCP server's config as an
`Authorization: Bearer <key>` header. Search, metadata and design-system token
tools work without one. Code, prompts and DESIGN.md files need a key on a paid
plan or inside the account's free 3-day trial, which the first such call
starts.

---

## Step 0 — Which path?

**Call `list_collections` first.** It's free on every account.

- A relevant collection exists → **Path A**. The user already did the choosing.
- No collection, or nothing relevant → **Path B**.
- It says no key is configured → **Path B**, without calling `get_collection`
  (it needs the same key, and a guessed collection name finds nothing). Tell the
  user once that code and DESIGN.md files will need a key — see Setup above —
  and carry on with everything that works without one.

Several collections and no obvious match → ask. Don't guess between two curated
sets.

---

## Step 1 — Requirements, including brand

Do this on both paths, before choosing a system. Two groups of things.

**The build:**

1. **Purpose** — what is this for? (SaaS product, local service business,
   portfolio, storefront, internal dashboard, docs site, …)
2. **Audience** — who is it for?
3. **Tone** — 2-3 words ("calm and minimal", "bold and playful", "editorial and
   serif-driven", "warm and local"). This is what Step 2 matches against.
4. **Required sections** — the concrete list of what must exist.

**Their brand** — skip this and you ship a beautiful page that isn't theirs:

5. **Logo or wordmark** — do they have one, and in what format?
6. **Brand colours** — hex values if they have them, and whether they are fixed
   (a franchise or a rebrand-in-progress changes the answer).
7. **Existing typeface** — anything already in use they need to stay with?
8. **Photography or illustration** — real assets to work from, or
   placeholder-and-replace-later?
9. **An existing site or profile** to stay consistent with.

No brand at all → say so plainly and use the design system's own palette. Don't
invent a logo.

If the user already stated all this, don't re-ask — restate it in one line and
move on.

---

## Path A — the user curated a collection

`get_collection({ listId })` (or `name`). Every item carries a `kind` —
`design_systems` or `ui_blocks` — plus a top-level `designSystems` array and a
`guidance` line.

1. **The collection's design system wins.** One in it → that is the system, no
   searching; `get_design_system_file` for its DESIGN.md. More than one → ask
   which; they saved both deliberately. None → say so, choose one as in Path B,
   and tell them which and why.
2. **Cover each required section from the collection first.** If the user saved
   something that covers a section, use it. Always. **Never substitute a
   catalog component for one they explicitly saved**, even if you found
   something you think is better — that was their call, not an oversight.
3. **Fill the gaps with `search_components`**, searching the whole catalog on
   fit, and restyle what you find to the collection's design system.
4. **Report what you filled in.** "Hero, pricing and footer from your
   collection; you had no testimonial section saved, so I pulled one from the
   catalog and restyled it." They should never have to diff the result to find
   out what they didn't choose.

Continue to Step 3.

---

## Path B — you choose

### B1. Shortlist design systems, then ask

Design systems are classified by **tag**, not by category — there is no tree to
walk. Call `search_design_systems` with no arguments first if you don't know
what exists: it returns every system plus `availableTags`, the full filterable
vocabulary (`theme:`, `style:`, `industry:` and so on).

Then filter with `tags` (ANDed) and/or a free-text `query` built from the tone
words plus purpose:

```
search_design_systems({ tags: ["theme:light", "industry:local-business"] })
search_design_systems({ query: "calm minimal saas", tags: ["theme:light"] })
```

A system can carry several `industry:` tags — a developer-tools system is
often a SaaS system too — so don't treat one tag as excluding the others.

Every result comes back with its tags, its token summary (colours, fonts,
radius) and a `previewUrl`. **Present the 2-3 best matches to the user with
their names, one-line descriptions, palettes and preview URLs, and ask which
they want.** Don't pick silently. This single choice shapes every screen, it
costs one question, and the user has taste you cannot infer from "a roofing
business".

Then `get_design_system` on their pick for the ungated token summary, and
`get_design_system_file` for the full DESIGN.md.

If nothing matches well, say so and ask whether to go with the closest or with
a system they describe by hand — don't quietly fall back to stock Tailwind
defaults, which is the "AI slop" this workflow exists to avoid.

**Read the whole DESIGN.md before fetching any component.** It's short by
design — tokens plus a page or two of intent prose, meant to be held in context
for the entire build. Its **Do's and Don'ts** section is the part doing the real
work.

### B2. Find components on fit

For each required section, call `search_components` — `section`, `framework`
and `tags` filters as needed, with `tags` ANDed the same way
(`["style:editorial"]`, `["animation:carousel"]`). Pick the best
**structural** match: the thing that actually does what the section needs.
Largely ignore how it currently looks; you are restyling it regardless.

Then `get_component_code` for the ones you'll use.

---

## Step 3 — Apply the system, and fit the brand into it

Two moves, in this order.

**A. Restyle everything to the design system.** Same colour variables, same type
scale, same radius, same spacing scale, same motion durations and easing, across
every component. Where a fetched component's own defaults conflict with the
system, the system wins — adapt the component, and never leave both looks in
play at once.

**B. Substitute the brand into the system's tokens.** This is what makes the
result *theirs* rather than a nice demo:

- Their primary colour replaces the system's `accent` token. A secondary, if
  they have one, replaces a supporting token — not a second accent.
- Their wordmark typeface replaces the `display` face if it suits headlines.
  Body text stays the system's text face unless they insist.
- Their photography replaces placeholder imagery at the same crops and ratios.

**Substitute values, keep the rules.** The system's spacing scale, radius
discipline, contrast requirements and "one accent moment per screen" all still
apply after the swap — that is the point of a system: it survives a brand
change. A roofing company's green goes where the indigo was, and the restraint
around it is unchanged.

**Check contrast after substituting.** A brand colour that fails the system's
stated contrast pairs is a real problem: tell the user, propose a darker or
lighter variant of their colour for text, and keep the original for large
fills. Don't silently ship unreadable text because it was their hex.

DESIGN.md files follow the open [DESIGN.md
format](https://github.com/google-labs-code/design.md): YAML front matter with
machine-readable tokens (`colors`, `typography`, `rounded`, `spacing`,
`components`, with `{colors.accent}` references already resolved), then prose
sections. Take concrete values from the front matter and the rules from the
prose.

## Step 4 — Polish pass (before calling anything done)

Run this against the assembled result. These are the "AI slop" tells noslopUI
exists to avoid — catch them here rather than shipping them:

- **Typography** — one display face used sparingly (headlines only, not buttons
  or body), one text face for everything else. Nothing outside the DESIGN.md's
  stated scale.
- **Color/contrast** — one accent moment per screen, not accent bleeding into
  every icon, border and badge. Real contrast on text over any background,
  checked against the DESIGN.md's own stated pairs.
- **Spacing** — compose from the DESIGN.md's spacing scale; don't invent
  in-between values. Prefer more whitespace over a denser grid.
- **Motion** — only where it communicates a real state change; the DESIGN.md's
  durations and easing, never a default bounce or spring.
- **Named slop-tells to actively reject**: gradient text, purple-on-purple
  palettes, bounce/spring easing on everything, every layout centered with no
  asymmetry, decorative-only animation.

## Step 5 — Point back to the catalog for variations

If the result doesn't land, don't re-prompt the same component blind. Point the
user at `noslopui.com/explore` (cross-catalog search across UI Blocks and
Design Systems in one grid) to browse real alternatives, and at the
Collections tab on `noslopui.com/account` to save the ones they like — which
turns the next build into Path A. Then repeat from Step 3 with whatever they
pick.

---

## Quick reference — tool call shape

```
list_collections({})                                           -> { collections: [{ id, name, itemCount }] }
get_collection({ listId?, name? })                             -> { collection, designSystems: [{id,name}], items: [{ id, name, kind, ... }], guidance }

search_design_systems({ query?, tags?, tag?, limit? })          -> { results: [{ id, name, description, tags, tokens, previewUrl, url }], availableTags }
get_design_system({ id })                                       -> { id, name, tokens, previewUrl, detailUrl }
get_design_system_file({ id })                                  -> { id, name, designMd }       [gated: paid or trial]

search_components({ query?, section?, framework?, tags?, tag?, limit? }) -> { results: [{ id, name, kind, tags, url }] }
get_component({ id })                                             -> { id, name, dependencies, builtWithDesignSystem, previewUrl, detailUrl }
get_component_code({ id })                                         -> { id, name, snippets: [{ language, code }] } [gated: paid or trial]
get_component_prompt({ id })                                        -> { id, name, promptText }   [gated: paid or trial]
```

The key rides on the connection (the `Authorization` header), so no tool needs
an `apiKey` argument. Every search, metadata and collection tool is free on
every account; `get_design_system_file`, `get_component_code` and
`get_component_prompt` need the account on a paid plan or inside its free
3-day trial.

- If a gated call's result carries a `trial` field, that call just started the
  user's trial — tell them, with the end date it gives.
- A trial covers up to 30 different items per 24 hours, far more than one site
  needs. Fetch what the build uses, not the catalog speculatively; re-fetching
  an item you already opened never counts again.
- If a gated call says the trial has ended (or the fair-use limit is reached),
  stop and tell the user plainly — don't retry, and don't quietly swap in
  something generated from scratch in its place. Search and collections keep
  working, so the plan itself can still be finished.
