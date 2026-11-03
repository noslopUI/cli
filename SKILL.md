---
name: noslopui
description: Build a distinctive, non-generic page or app UI with noslopUI's hand-crafted catalog over MCP. Plans the page from the visitor's goal, chooses one design system and restyles real catalog components to it, writes the copy first, and checks the result against the measured AI-design tells (cream grounds, serif headline with one italic word, eyebrow labels, thin pages, invented proof). Use when asked to build a landing page, homepage, dashboard, portfolio or any new page or section, when the user mentions a noslopUI collection, or when a UI looks like "AI slop" and needs a real design system.
version: 2026-11-04
---

# noslopUI

You have access to the **noslopUI MCP server**: a catalog of hand-crafted (not
AI-generated) UI components, full page examples, and portable design systems.

## The rules

1. **Choose one design system before fetching any component, then restyle every component to it**: colours, type scale, spacing, radius, motion. One system applied everywhere is what stops a multi-page build reading as a collage.
2. **Search the catalog for every section before hand-building any of them.** Plan the sections first, then call `find_sections` once for all of them (or `search_components` per section). Any component can be built in any system, so nothing is off-limits once one is chosen. **Keep a component's composition** (its layout, scale relationships, density and imagery) **and change its values** (colours, faces, radius, timing) to the system. Only build a section yourself if nothing in the catalog fits it, and say so.
3. **Never substitute a catalog component for one the user explicitly saved** in a collection. Their pick was a decision, not an oversight.
4. **Ask about their brand before building**: logo, brand colours, typeface, real photography. Put their values into the system's tokens (their colour replaces `accent`) and keep the system's rules.
5. **Collections only when the user asks for them.** Don't call `list_collections` or `get_collection` unless the user mentions their saved items, favourites or a collection, or names one. Never offer a collection as an option: the default "Favorites" list is where the save button drops single items, not a build kit. Without an ask, shortlist two or three design systems with `search_design_systems` and let the user pick.
6. **If a gated tool says the trial has ended or the fair-use limit is reached, tell the user and stop**. Don't retry, and don't swap in something generated from scratch.
7. **A Motion Lab effect is a signature moment, not a section.** Reach for one (`search_components` with `section: "motion_lab"`) when the user asks for an effect, motion, 3D or a showpiece, or the brief clearly calls for one. Then use one per page unless they ask for more. Recolour it through its `colorVars` to the design system's tokens, follow its `usage`, and keep its reduced-motion fallback.
8. **Use the system's own hover, active and disabled states for every button, and where one is missing change the fill and the label colour together.** A hover that darkens the background but leaves dark text on it is unreadable, so check the label against the *new* fill, never just the old one. Variants (`button-secondary`, `-tinted`, `-outline`, `icon-button`) each have their own `-hover` entry in the DESIGN.md; do not reuse the primary's.
9. **The catalog's photos, product shots and videos are noslopUI's demo media, not the user's.** Before shipping, list every image and video the build uses and ask how to replace each: their own, generated, or a placeholder. A placeholder is a labelled frame that names the intended shot. Use a stock or random photo only when the user asks for photo placeholders, because an unrelated photo (a skateboard on a bakery) misrepresents the business. Never ship a demo's logo or lettering as theirs.
10. **Never invent proof**: no numbers, ratings, quotes, names, logos or "trusted by" the user didn't give. Use a marked placeholder (at most two on a page) or show the product instead.
11. **Write the copy before the markup, and check the page before calling it done.** `get_guide` serves the references (`copy`, `tells`, `page-goals`, `layout`, `review`) and `audit_page` lints a page. Hard rules always get fixed. The style tells are **signals, not bans**: a cream ground, a serif headline or a pill button is a normal choice on its own, and a page gets a **budget of two**. Stacking three or more is the AI house style, so bring it back to two.

Setup, if the noslopUI tools aren't available: the user runs
`npx noslopui@latest init`, or adds `https://noslopui.com/api/mcp` in their
agent and signs in when it asks (steps for each agent: `noslopui.com/mcp`).
Every call runs as the user's account. Search, metadata, guides, the page
audit and collections are free on every account. Code, prompts and DESIGN.md
files need a paid plan or the account's free 3-day trial, which the first such
call starts.

**This skill is version 2026-11-04.** The server's instructions name the
current version. If they name a newer one, call `get_guide({ topic: "workflow" })`
and follow that instead of this file.

**The references.** Five short guides carry the detail this workflow points
to. Fetch each one at the step that names it, with
`get_guide({ topic })`: `page-goals`, `layout`, `copy`, `tells` and `review`.

**You will drift toward the same few choices** (cream grounds, a serif
headline with one italic word, a small label over every heading, three equal
cards, "Know which X actually Y"). Every model does; we measured it. None of
them is wrong on its own. Stacked, they are the AI house style. So the style
tells are signals with a **budget of two per page** (`tells`): spend it on
purpose, on the choices that serve this brand. The steps below exist to catch
that drift. Follow them in order, and trust what you measure over what you
meant.

---

## Step 0: Is this a collection build?

Only if the user mentioned their saved items, favourites or a collection, or
named one. Then call `list_collections`, find the one they meant, and follow
**Path A** below. If they named nothing, don't call `list_collections`, don't
mention collections, and go to Step 1. A collection existing is not a request
to use it.

---

## Step 1: Ask once

One message, every question at once, each with a sensible default the user
can accept with "go ahead":

1. **What it's for and who it's for**, in a sentence.
2. **The one action** a visitor should take (book, buy, call, sign up…).
3. **Tone**, in two or three words.
4. **Brand:** logo, colours (fixed or flexible?), typeface, an existing site
   to stay consistent with.
5. **Material:** anything real you can use, such as prices, menu, services,
   hours, address, team, reviews, numbers, screenshots, photos.
6. **Images:** their own photos, generated ones (you'll write the prompts),
   or placeholders. A placeholder is a labelled frame naming the shot, unless
   they ask for placeholder photos.

If the user already said some of this, restate it in one line instead of
asking again. **If nobody can answer** (an unattended run, or the user said
"just build it"), don't ask: infer each answer from the brief, state what you
assumed, and continue. Assume labelled frames for images and no proof you
weren't given.

No brand at all → say so plainly and use the design system's own palette.
Don't invent a logo.

---

## Step 2: The goal and the page plan

`get_guide({ topic: "page-goals" })`, then `get_guide({ topic: "layout" })`.

1. Name the **screen type** (`marketing`, `app`, `content` or `showcase`),
   chosen from the screen you're building, not the product. A dashboard
   tool's landing page is `marketing`.
2. Name the **visitor goal** and read its entry.
3. Write the **page plan**: for a marketing or showcase page, six to nine
   sections. For each one, write down:
   - what it's for
   - its content, taken from the user's material and never invented
   - its layout pattern from `layout`, never the same pattern twice in a row
   - its largest thing (its mass)

   Proof follows the goal's entry: the user's real proof, a marked placeholder
   (at most two on the page), or the product shown instead.

---

## Step 3: Choose the design system

`search_design_systems` with `surface` set to your screen type, plus the
industry and tone:

```
search_design_systems({ surface: "marketing", tags: ["industry:dentist"] })
search_design_systems({ surface: "marketing", query: "calm clinical", tags: ["industry:medical"] })
```

`industry:` is a two-level tree: a **field** (`food-drink`, `medical`,
`home-services`, `technology`…) and **niches** under it (`restaurant`,
`dentist`, `roofing`, `saas`…). Start with the niche; widen to the field when
fewer than three come back. "Local business" is not an industry: name the
trade. Ask for `includeVocabulary: true` once if you need the full tag list.

Each result carries a `look`: its ground (light or dark, warm or cool), its
display face class, its accent hue, and `slopLook` (true when it is the cream,
serif and terracotta look the models default to).

**Shortlist two or three that look clearly different from each other**:
light against dark, serif against sans, different accent hues. Fit with the
industry is necessary but not enough. A `slopLook` system goes last with a
note saying so, or is left out. Present the shortlist with names, one line
each, the look, and preview URLs, and **ask which one**. If nobody can
answer, pick the best fit that isn't `slopLook` and say why.

Then `get_design_system_file` on the pick, and **read the whole DESIGN.md**
before fetching any component. Its Do's and Don'ts are the part doing the work.
If its type ramp is smaller than `layout`'s sizes for a marketing page, scale
the roles up and keep the ratios.

If nothing fits, say so and ask whether to take the closest or describe one by
hand. Never fall back to stock Tailwind defaults.

---

## Step 4: Components for every section

Call `find_sections` once with the whole plan:

```
find_sections({
  surface: "marketing",
  sections: [
    { name: "hero", query: "hero with large product screenshot" },
    { name: "menu", query: "restaurant menu list with prices" },
    { name: "booking", query: "reservation form" }
  ]
})
```

It returns the best catalog candidates for each section, with preview URLs.
Run a second phrasing (or `search_components`) for any section that came back
weak. Open the previews of the ones you're considering.

For each section pick the component whose **composition** fits: the layout,
the scale relationships, the density, the kind of imagery. Then:

- **Keep the composition. Change the values.** Its structure, proportions and
  interaction stay; its colours, faces, radius and motion timing become the
  system's. Don't flatten a big, confident component into a generic one while
  restyling it.
- **Watch the budget.** Catalog components can carry signals of their own (an
  eyebrow, an italic word, a number strip). Keep a page at two or fewer in
  total: keep the ones that serve the brand and drop the rest while restyling.
- Only hand-build a section when nothing fits. Say which searches you ran.

Every component is published as React/TSX with Tailwind classes, but its
markup and styling aren't React-specific. Converting to plain HTML, Vue or
anything else is a mechanical step, not a rebuild, so never skip a
structurally right component over its source format.

**Effects are a separate kind.** `section: "motion_lab"` searches Motion Lab:
shader backgrounds, 3D, liquid glass, text, cursor and scroll effects. Use one
where the brief asks for it or clearly calls for a showpiece, one per page
unless the user asks for more. `get_component` gives its `usage`, `props`,
`colorVars` and `libraries`.

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
- per section: the layout pattern, and the catalog item used or
  "hand-built: searched X and Y, nothing fit"
- the headline, and one runner-up
- every placeholder (copy, proof, media)

If the user is there, a quick "go ahead?" is fine. If not, continue.

---

## Step 7: Build the hero first, then review it

Build the nav and the hero only. Then review them, following
`get_guide({ topic: "review" })`: `audit_page`, look at the render if you can,
fresh eyes if you can. Fix what it finds. The hero sets the type scale, the
colour use and the voice for the rest, so it's cheapest to fix here.

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

**D. Media.** Components ship with noslopUI's demo photos and frames, usually
from `assets.noslopui.com`. They show what a slot needs; they aren't the
user's. List every image and video with its size, whether it needs a
transparent background, and how it moves, and use what the user chose in
Step 1:

- **Their own:** wire it in at the slot's crop.
- **A placeholder:** a labelled frame in the system's colours, with the
  intended shot written on it and in `alt`, plus
  `<!-- PLACEHOLDER: <shot>, <w>x<h> -->` above it. For example: "Photo: the
  counter at 7am, bread on the shelves, 1600×1000". Use a photo service
  (`https://picsum.photos/seed/<slug>-<slot>/<w>/<h>`) only when the user asked
  for placeholder *photos*, and mark those the same way.
- **Generated:** write `image-prompts.md`, one prompt per asset with its file
  name, size and aspect. The user pastes each into the image app they trust
  and saves the results to `public/images/` under those names; or, if you
  have a good image tool, generate from the same prompts. Look at every
  result on the page before using it.

Pick the medium by how the thing moves:

| How it moves | What to make |
|---|---|
| Not at all (photo, product shot, cut-out) | An image |
| As a whole: slides, scales, rotates, fades, parallax | An image; the component's code moves it |
| Changes shape, photoreal: a pour, a spill, a splash, billowing smoke, cloth, fire | A short video, played as frames or a loop. Never a stack of generated stills |
| Changes shape, but thin or stylised: steam, a wisp, a ripple | Code: SVG or a blurred shape with a CSS keyframe, or a shader |
| Abstract (gradients, particles, noise) | Code. Use a Motion Lab effect |

Write image prompts from the DESIGN.md's imagery prose and the user's brand:
their product, their colours, the slot's crop and the light the system
describes. Describe a real photograph ("a product photograph of…"). No film
grain or haze. For a cut-out, ask for a flat background in a colour the
subject doesn't contain. Never generate people presented as real customers,
staff or reviewers, and never generate a logo the user doesn't have.

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

**Report:** what you changed after reviewing; the signals the page spends its
budget on, and any warning kept, with its id and reason; and everything still a
placeholder.

---

## Step 10: Variations

If the result doesn't land, don't re-prompt the same component blind. Point
the user at `noslopui.com/explore` to browse alternatives, and at the
Collections tab on `noslopui.com/account` to save the ones they like. That
turns the next build into Path A.

---

## Path A: the user asked for a collection

`get_collection({ listId })` (or `name`). Every item carries a `kind`:
`design_systems`, `ui_blocks` or `motion_lab`. There's also a top-level
`designSystems` array and a `guidance` line.

1. **The collection's design system wins.** If there's one, that's the
   system, so skip Step 3's search. If there are several, ask which one. If
   there are none, choose as in Step 3 and say which you chose and why.
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
get_guide({ topic })                                             -> { topic, version, text }   topics: workflow, page-goals, layout, copy, tells, review
audit_page({ html, css? })                                       -> { findings: [{ id, level, tell, fix, evidence }], summary }

search_design_systems({ surface?, query?, tags?, limit?, includeVocabulary? })
                                                                 -> { results: [{ id, name, description, tags, look, palette, fonts, previewUrl, url }] }
get_design_system({ id })                                        -> { id, name, tokens, previewUrl, detailUrl }
get_design_system_file({ id })                                   -> { id, name, designMd }       [gated: paid or trial]

find_sections({ sections: [{ name, query }], surface?, tags? })  -> { sections: [{ name, candidates: [{ id, name, description, previewUrl, url }] }] }
search_components({ query?, section?, surface?, tags?, limit? }) -> { results: [{ id, name, kind, tags, previewUrl, url }] }
get_component({ id })                                            -> { id, name, dependencies, builtWithDesignSystem, previewUrl, detailUrl }
                                                                    motion_lab items add { usage, props, colorVars, libraries }
get_component_code({ id })                                       -> { id, name, snippets: [{ language, code }] } [gated: paid or trial]
get_component_prompt({ id })                                     -> { id, name, promptText }   [gated: paid or trial]

list_collections({})                                             -> only when the user asked for a collection
get_collection({ listId?, name? })                               -> { collection, designSystems, items: [{ id, name, kind }], guidance }
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
