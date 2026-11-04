---
name: noslopui
description: Build a distinctive, non-generic page or app UI with noslopUI's hand-crafted catalog over MCP. Plans the page from the visitor's goal, chooses one design system and restyles real catalog components to it, writes the copy first, and checks the result against the measured AI-design tells (cream grounds, serif headline with one italic word, eyebrow labels, thin pages, invented proof). Use when asked to build a landing page, homepage, dashboard, portfolio or any new page or section, when the user mentions a noslopUI collection, or when a UI looks like "AI slop" and needs a real design system.
version: 2026-11-04.4
---

# noslopUI

You have access to the **noslopUI MCP server**: a catalog of hand-crafted (not
AI-generated) UI blocks in over a hundred categories, full page examples, Motion Lab
effects and portable design systems. This file is the build workflow. Follow it
step by step: every noslopUI tool result ends with a `nextStep` that tells you
where you are in it.

## Before you start

1. **Are the noslopUI tools connected?** You need `search_design_systems`,
   `find_sections` and `get_guide`. If they aren't there, stop and tell the
   user, then build only once they are connected. They connect it in one of
   these ways:
   - run `npx noslopui@latest init`, which sets up the server and this skill
     for every agent it finds and signs in through the browser once
   - add `https://noslopui.com/api/mcp` in their agent and approve the sign-in
     it shows (steps for each agent: `noslopui.com/mcp`)
2. **Signed in?** If a call answers that noslopUI needs a sign-in, or that the
   key or token is invalid, revoked or expired, ask the user to approve the
   sign-in their agent shows (often an "Authenticate" button), or to run
   `npx noslopui@latest login`. Then carry on from the same step. Don't build
   without the catalog while you wait.
3. **Is this skill current?** This file is version **2026-11-04.4**. The
   server's instructions name the current version. If theirs is newer, call
   `get_guide({ topic: "workflow" })` and follow that instead. Tell the user
   once: "Your installed noslopUI skill is out of date; `npx noslopui@latest
   update` refreshes it."
4. **Track the steps.** If your harness has a task or todo list, add Steps 1 to
   9 now and tick each one off. Otherwise keep the step number in your
   messages. Follow each tool result's `nextStep`.

Every call runs as the user's account:
- **Free on every account:** search, metadata, guides, the page audit and
  collections.
- **Paid plan or free 3-day trial:** code, prompts and DESIGN.md files. The
  first such call starts the trial.

## The flow at a glance

| Step | What | Tools |
|---|---|---|
| 0 | Collection build? Only if the user asked for one | `list_collections`, `get_collection` |
| 1 | Ask once: purpose, action, tone, brand, material, **images** | none |
| 2 | Visitor goal, page plan, and each section mapped to a catalog category | `get_guide` page-goals, layout, catalog |
| 3 | Shortlist design systems that look different; pick one | `search_design_systems`, `get_design_system_file` |
| 4 | Components for every section; study the category before picking | `find_sections`, `browse_category`, `get_component_code` |
| 5 | Write the copy first | `get_guide` copy |
| 6 | Post the picks | none |
| 7 | Build the hero, then review it | `get_guide` review, `audit_page` |
| 8 | Build the rest; fit the brand; images | none |
| 9 | Review the whole page and report | `audit_page` |

## The rules

1. **Choose one design system before fetching any component, then restyle every component to it**: colours, type scale, spacing, radius, motion. One system applied everywhere is what stops a multi-page build reading as a collage.
2. **Search the catalog for every section before hand-building any of them.** Map each planned section to a catalog category (`get_guide({ topic: "catalog" })`), call `find_sections` once for the whole plan, and `browse_category` to see every option in a category before picking the ones that carry the page. Any component can be built in any system, so nothing is off-limits once one is chosen. **Keep a component's composition** (its layout, scale relationships, density and imagery) **and change its values** (colours, faces, radius, timing) to the system. Only build a section yourself if nothing in its category fits, and say so.
3. **Never substitute a catalog component for one the user explicitly saved** in a collection. Their pick was a decision, not an oversight.
4. **Ask about their brand before building**: logo, brand colours, typeface, real photography. Put their values into the system's tokens (their colour replaces `accent`) and keep the system's rules.
5. **Collections only when the user asks for them.** Don't call `list_collections` or `get_collection` unless the user mentions their saved items, favourites or a collection, or names one. Never offer a collection as an option: the default "Favorites" list is where the save button drops single items, not a build kit. Without an ask, shortlist two or three design systems with `search_design_systems` and let the user pick.
6. **If a gated tool says the trial has ended or the fair-use limit is reached, tell the user and stop**. Don't retry, and don't swap in something generated from scratch.
7. **A Motion Lab effect is a signature moment, not a section.** Reach for one (`search_components` with `section: "motion_lab"`) when the user asks for an effect, motion, 3D or a showpiece, or the brief clearly calls for one. Then use one per page unless they ask for more. Recolour it through its `colorVars` to the design system's tokens, follow its `usage`, and keep its reduced-motion fallback.
8. **Use the system's own hover, active and disabled states for every button, and where one is missing change the fill and the label colour together.** A hover that darkens the background but leaves dark text on it is unreadable, so check the label against the *new* fill, never just the old one. Variants (`button-secondary`, `-tinted`, `-outline`, `icon-button`) each have their own `-hover` entry in the DESIGN.md; do not reuse the primary's.
9. **The catalog's photos, product shots and videos are noslopUI's demo media, not the user's.** Ask once how images should be done: (a) their own photos, (b) generated now with an image tool or an image API key they give you, (c) placeholder photos to replace before launch, or (d) labelled frames that name the shot. With nobody to answer: generate if an image tool or key is already available, otherwise labelled frames. Never ship an unrelated photo as if it were theirs, and never a demo's logo or lettering.
10. **Never invent proof**: no numbers, ratings, quotes, names, logos or "trusted by" the user didn't give. Use a marked placeholder (at most two on a page) or show the product instead.
11. **Write the copy before the markup, and check the page before calling it done.** `get_guide` serves the references (`copy`, `tells`, `page-goals`, `layout`, `review`) and `audit_page` lints a page. Hard rules always get fixed. The style tells are **signals, not bans**: a cream ground, a serif headline or a pill button is a normal choice on its own, and a page gets a **budget of two**. Stacking three or more is the AI house style, so bring it back to two.

**You will drift toward the same few choices** (cream grounds, a serif
headline with one italic word, a small label over every heading, three equal
cards, "Know which X actually Y"). Every model does; we measured it. None of
them is wrong on its own. Stacked, they're the AI house style. So the style
tells are signals with a **budget of two per page** (`tells`): spend it on
purpose, on the choices that serve this brand. Trust what you measure over what
you meant.

---

## Step 0: Is this a collection build?

Only if the user mentioned their saved items, favourites or a collection, or
named one. Then call `list_collections`, find the one they meant, and follow
**Path A** below. If they named nothing, don't call `list_collections`, don't
mention collections, and go to Step 1. A collection existing is not a request
to use it.

---

## Step 1: Ask once

One message, every question at once, each with a default the user can accept
with "go ahead":

1. **What it's for and who it's for**, in a sentence.
2. **The one action** a visitor should take (book, buy, call, sign up…).
3. **Tone**, in two or three words.
4. **Brand:** logo, colours (fixed or flexible?), typeface, an existing site
   to stay consistent with.
5. **Material:** anything real you can use, such as prices, menu, services,
   hours, address, team, reviews, numbers, screenshots, photos.
6. **Images.** Offer these four, with what each looks like:
   - **a. Your own photos:** send them or point to them.
   - **b. Generate them now:** if you have an image tool, or the user gives
     an image API key (Gemini, OpenAI or another), you write a prompt per
     image and generate them all, so the page is finished in one go.
   - **c. Placeholder photos:** finished-looking stock photos from a
     placeholder service. Fast, but not of their business, so they must be
     replaced before launch.
   - **d. Labelled frames:** a frame in the system's colours that names the
     shot to take ("Photo: the counter at 7am, bread on the shelves"). The
     most honest, but it looks unfinished.

If the user already said some of this, restate it in one line instead of
asking again.

**If nobody can answer** (an unattended run, or "just build it"), don't ask.
Infer each answer from the brief and state what you assumed:
- **Images:** generate them (b) if you have an image tool or a key is already
  configured; otherwise use labelled frames (d). Say in the report that one
  image key would finish them.
- **Proof:** none that you weren't given.
- **No brand at all:** say so plainly and use the design system's own palette.
  Don't invent a logo.

---

## Step 2: The goal, the page plan, the categories

`get_guide({ topic: "page-goals" })`, then `get_guide({ topic: "layout" })`.

1. Name the **screen type** (`marketing`, `app`, `content` or `showcase`),
   chosen from the screen you're building, not the product. A dashboard
   tool's landing page is `marketing`.
2. Name the **visitor goal** and read its entry.
3. **Look at the whole page examples first.** `browse_category` on the page
   examples for your goal (`marketing/page-examples/landing-pages`, `about-pages`,
   `pricing-pages`; `ecommerce/page-examples/*`; `application-ui/page-examples/*`).
   If one fits, start from it and swap or add sections; say which in the picks.
4. **An app screen is planned by region, not by section.** Pick a shell first
   (sidebar, multi-column or stacked, from `application-ui/application-shells`),
   then list its regions and map each to a category. `page-goals` has the
   regions for common screens: dashboard, inbox, list and detail, settings,
   calendar, kanban.
5. Write the **page plan**: for a marketing or showcase page, six to nine
   sections. For each one, write down:
   - what it's for
   - its content, taken from the user's material and never invented
   - its layout pattern from `layout`, never the same pattern twice in a row
   - its largest thing (its mass)

   Proof follows the goal's entry: the user's real proof, a marked placeholder
   (at most two on the page), or the product shown instead.
6. **Map every section (or region) to a catalog category.** Call
   `get_guide({ topic: "catalog" })`, the live map of all categories with
   counts. Write the category path next to each planned section, for example
   `footer → marketing/page-sections/footers` or
   `product grid → ecommerce/components/product-lists`. The catalog covers far
   more than heroes and features: navigation, banners, flyout menus, 404
   pages, store navigation, product pages, carts, checkout, forms, tables,
   settings and whole page examples. If a whole page example matches the goal
   (landing, about, pricing, storefront, product page), note it as a
   structure reference.

---

## Step 3: Choose the design system

`search_design_systems` with `surface` set to your screen type, plus the
industry and tone:

```
search_design_systems({ surface: "marketing", tags: ["industry:dentist"] })
search_design_systems({ surface: "marketing", query: "calm clinical", tags: ["industry:medical"] })
```

`industry:` is a two-level tree:
- a **field** (`food-drink`, `medical`, `home-services`, `technology`…)
- **niches** under it (`restaurant`, `dentist`, `roofing`, `saas`…)

Start with the niche; widen to the field when fewer than three come back.
"Local business" is not an industry: name the trade. Ask for
`includeVocabulary: true` once if you need the full tag list.

Each result carries a `look`:
- its ground: light or dark, warm or cool
- its display class
- its accent hue
- `slopLook`: true only when it combines a cream or espresso ground, a serif
  display and a terracotta accent

**Shortlist two or three that look clearly different from each other**:
light against dark, serif against sans, different accent hues. Fit with the
industry is necessary but not enough. A `slopLook` system goes last with a
note, or is left out. Present the shortlist with names, one line each, the
look and the preview URLs, and **ask which one**. If nobody can answer, pick
the best fit and say why.

Then `get_design_system_file` on the pick, and **read the whole DESIGN.md**
before fetching any component. Its Do's and Don'ts are the part doing the work.
If its type ramp is smaller than `layout`'s sizes for a marketing page, scale
the roles up and keep the ratios.

If nothing fits, say so and ask whether to take the closest or describe one by
hand. Never fall back to stock Tailwind defaults.

---

## Step 4: Components for every section

Call `find_sections` once with the whole plan, each section carrying the
category you mapped in Step 2:

```
find_sections({
  surface: "marketing",
  sections: [
    { name: "hero", category: "hero-sections", query: "large product screenshot" },
    { name: "menu", category: "menu-sections", query: "restaurant menu with prices" },
    { name: "footer", category: "footers", query: "address hours map" }
  ]
})
```

Each section comes back with:
- its matched category and how many blocks that category holds
- candidates, with preview URLs and the category each came from
- `alsoSee`: related categories worth browsing (a dashboard's app shells and
  stats), with one candidate from each
- if no category fits, a note saying so and candidates from the whole catalog

**Study before you pick.** For the sections that carry the page (the hero, the
signature section) and for any category with more blocks than were shown, call
`browse_category({ category })`. It lists every block in that category with its
preview, so you choose from all seven footers, not the first three. The order is
random: the first one listed is not the best one. Open the previews of the
ones you're considering.

For each section pick the component whose **composition** fits: the layout,
the scale relationships, the density, the kind of imagery. Then:

- **Keep the composition. Change the values.** Its structure, proportions and
  interaction stay; its colours, faces, radius and motion timing become the
  system's. Don't flatten a big, confident component into a generic one while
  restyling it.
- **Watch the budget.** Catalog components can carry signals of their own (an
  eyebrow, an italic word, a number strip). Keep the page at two or fewer in
  total: keep the ones that serve the brand and drop the rest while restyling.
- **Only hand-build a section when nothing in its category fits.** Say which
  category you browsed and what you searched.

Every component is published as React/TSX with Tailwind classes. Its markup
and styling aren't React-specific: converting to plain HTML, Vue or anything
else is a mechanical step, not a rebuild. Never skip a structurally right
component over its source format.

**Effects are a separate kind.** `section: "motion_lab"` searches Motion Lab:
shader backgrounds, 3D, liquid glass, text, cursor and scroll effects.
- **When:** where the brief asks for one, or clearly calls for a showpiece.
- **How many:** one per page, unless the user asks for more.
- **Details:** `get_component` gives its `usage`, `props`, `colorVars` and
  `libraries`.

Then `get_component_code` for the ones you'll use.

---

## Step 5: Write the copy

`get_guide({ topic: "copy" })`. Write every word on the page into `copy.md`
before writing markup: five headline candidates, the pick, then each section.
Audit it against the copy tells, and for any fact the user didn't give you.

---

## Step 6: The picks

Before building, post one block the user can redirect from:

- screen type, visitor goal, the one action
- design system, and why it over the others
- the brand substitutions
- per section: the category, the layout pattern, and the catalog item used or
  "hand-built: browsed X, nothing fit"
- the headline, and one runner-up
- the images (which of a–d) and every other placeholder

If the user is there, a quick "go ahead?" is fine. If not, continue.

---

## Step 7: Build the hero first, then review it

Build the nav and the hero only. Then review them, following
`get_guide({ topic: "review" })`:
1. `audit_page`
2. look at the render, if you can
3. fresh eyes, if you can

Fix what it finds. The hero sets the type scale, the colour use and the voice
for the rest, so it's cheapest to fix here.

---

## Step 8: Build the rest

**A. Restyle everything to the design system:** the same colour variables,
type scale, radius, spacing scale, motion durations and easing across every
component. Where a component's defaults conflict with the system, the system
wins; never leave both looks in play.

**B. Fit the brand into the system's tokens:**
- Their primary colour replaces `accent`. A secondary replaces a supporting
  token, not a second accent.
- Their wordmark typeface replaces the display face if it suits headlines.
- Their photography goes into the image slots at the same crops.

Substitute values and keep the rules: spacing, radius discipline, contrast and
"one accent moment per screen" all survive the swap. **Check contrast after
substituting.** If their colour fails a stated pair, say so, propose a darker
or lighter variant for text, and keep the original for large fills.

**C. Effects take the system's colours through their variables** (`colorVars`,
e.g. `--ml-accent`). Tune their `props` toward the system's motion rules.
Never recolour inside a shader or script, and never remove a reduced-motion
fallback.

**D. Images.** Components ship with noslopUI's demo photos and frames, usually
from `assets.noslopui.com`. They show what a slot needs; they aren't the
user's. List every image and video with:
- its size
- whether it needs a transparent background
- how it moves

Then do what Step 1 settled:

- **a. Their own:** wire each one in at the slot's crop.
- **b. Generate:** write `image-prompts.md`, one prompt per image with its
  file name, size and aspect.
  - **If you have an image tool,** generate from the prompts.
  - **If the user gave an API key,** write a small script that reads the key
    from an environment variable (never from a file you save or commit),
    calls the image API for each prompt and saves the results to
    `public/images/` under those names. Run it.
  - **Otherwise,** the user pastes each prompt into the image app they trust
    and saves the results under those names.

  Either way, look at every result on the page before using it, and
  regenerate a weak one.
- **c. Placeholder photos:** `https://picsum.photos/seed/<slug>-<slot>/<w>/<h>`,
  each marked `<!-- PLACEHOLDER: replace before launch, <shot>, <w>x<h> -->`,
  with `alt` describing the intended shot.
- **d. Labelled frames:** a frame in the system's colours with the intended
  shot written on it and in `alt`, and
  `<!-- PLACEHOLDER: <shot>, <w>x<h> -->` above it.

Pick the medium by how the thing moves:

| How it moves | What to make |
|---|---|
| Not at all (photo, product shot, cut-out) | An image |
| As a whole: slides, scales, rotates, fades, parallax | An image; the component's code moves it |
| Changes shape, photoreal: a pour, a spill, a splash, billowing smoke, cloth, fire | A short video, played as frames or a loop. Never a stack of generated stills |
| Changes shape, but thin or stylised: steam, a wisp, a ripple | Code: SVG or a blurred shape with a CSS keyframe, or a shader |
| Abstract (gradients, particles, noise) | Code. Use a Motion Lab effect |

Write image prompts from the DESIGN.md's imagery prose and the user's brand:
- their product, their colours, the slot's crop, the light the system describes
- a real photograph ("a product photograph of…"), with no film grain or haze
- for a cut-out, a flat background in a colour the subject doesn't contain

Never generate people presented as real customers, staff or reviewers, and
never generate a logo the user doesn't have.

**For a video, write `video-briefs.md`.** The user makes the clip in a video
app from a first frame generated as above, and checks its terms for
watermarks and commercial use. Each brief gives:
- **Motion:** what happens over 2–5 seconds, with a static camera and limits
  in words ("everything stays well inside the frame with empty margin on
  every side").
- **Clean edges:** opaque, solid motion; no fine mist, spray, motion blur or
  shadows.
- **Background:** a flat key colour for solid subjects, pure black for light
  or soft ones.
- **What the component expects:** frame count, size and frame rate, read from
  its code.

Check frames from the start, middle and end of a clip on the page's real
background before using it.

---

## Step 9: Review the whole page

`get_guide({ topic: "review" })` again, on the full page:
1. `audit_page`
2. look at it at 1440, 1280 and 390 if you can render
3. walk the tells
4. fresh eyes

Then the browser surfaces: `::selection`, the focus ring and the caret take
the system's colours, and `prefers-reduced-motion` is respected. Then the
search basics from `copy`.

**Report:**
- what you changed after reviewing
- the signals the page spends its budget on, and any warning kept, with its id
  and reason
- everything still a placeholder (with one line on how to finish the images
  if they're frames)

If the result doesn't land, don't re-prompt the same component blind. Use
`browse_category` for the section that's wrong, or point the user at
`noslopui.com/explore` and the Collections tab on `noslopui.com/account` to
save the ones they like. That turns the next build into Path A.

---

## Path A: the user asked for a collection

`get_collection({ listId })` (or `name`). Every item carries a `kind`:
`design_systems`, `ui_blocks` or `motion_lab`. There's also a top-level
`designSystems` array and a `guidance` line.

1. **The collection's design system wins.**
   - **One in it:** that's the system, so skip Step 3's search.
   - **Several:** ask which one.
   - **None:** choose as in Step 3, and say which you chose and why.
2. **Cover each section from the collection first.** If the user saved
   something that covers a section, use it, always. Never substitute a
   catalog component for one they explicitly saved.
3. **Fill the gaps with `find_sections`** and restyle what you find to the
   collection's system.
4. **Report what you filled in**, for example: "Hero, pricing and footer from
   your collection; you had no testimonial section saved, so I pulled one
   from the catalog and restyled it."

Steps 1, 2 and 5 to 9 apply as usual.

---

## Quick reference: tool call shapes

```
get_guide({ topic })            -> the guide's text
  topics: workflow, catalog, page-goals, layout, copy, tells, review
audit_page({ html, css?, surface? })
                                -> { findings: [{ id, level, tell, fix, evidence }], summary, nextStep }

search_design_systems({ surface?, query?, tags?, limit?, includeVocabulary? })
                                -> { results: [{ id, name, description, tags, look, colors, fonts, previewUrl, url }], nextStep }
get_design_system({ id })       -> { id, name, tokens, previewUrl, detailUrl }
get_design_system_file({ id })  -> { id, name, designMd, nextStep }   [gated: paid or trial]

find_sections({ sections: [{ name, category?, query? }], surface?, tags?, perSection? })
                                -> { sections: [{ name, category, inCategory, candidates: [...] }], nextStep }
browse_category({ category, surface?, limit? })
                                -> { category, total, items: [{ id, name, description, previewUrl, url }], nextStep }
search_components({ query?, section?, surface?, tags?, limit? })
                                -> { results: [{ id, name, kind, tags, url }] }
get_component({ id })           -> { id, name, dependencies, builtWithDesignSystem, previewUrl, detailUrl }
                                   motion_lab items add { usage, props, colorVars, libraries }
get_component_code({ id })      -> { id, name, snippets: [{ language, code }], nextStep }   [gated: paid or trial]
get_component_prompt({ id })    -> { id, name, promptText }   [gated: paid or trial]

list_collections({})            -> only when the user asked for a collection
get_collection({ listId?, name? })
                                -> { collection, designSystems, items: [{ id, name, kind }], guidance }
```

`promptText` is the component's full code wrapped in integration instructions.
You don't need it to build; it's for handing one component to a different
agent or tool.

The account rides on the connection, so no tool takes a credential argument.

- If a gated call's result carries a `trial` field, that call just started the
  user's trial. Tell them, with the end date it gives.
- Fetch only what the build uses. Re-fetching an item you already opened is
  always fine.
- If a gated call says the trial has ended or the fair-use limit is reached,
  stop and tell the user plainly. Search, guides and the audit keep working,
  so the plan itself can still be finished.
