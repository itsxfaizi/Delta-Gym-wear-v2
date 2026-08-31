# Delta Home Prototype Corrective Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public home route as the five verified Figma prototype frame states, preserving the final newsletter/footer composite and accessible reduced-motion flow.

**Architecture:** A narrowly scoped client scene controller maps native page scrolling to five deterministic visual states within one pinned desktop stage. Each source-backed scene remains semantic content for reduced motion and small screens. Static composition remains in `HomeView`; only scroll state and first-session logo state live in the controller.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS custom properties, Jest, Playwright.

**Spec:** `docs/figma-audit.md`

## Global Constraints

- Use only approved local design-reference artifacts; do not recreate unavailable Figma vectors.
- Preserve cart, catalog, product detail, and all non-home routes.
- Desktop uses native scroll input only; no wheel/touch interception.
- Reduced motion and mobile render all source-backed sections in normal document flow.
- Maintain WCAG 2.2 AA focus order, landmark structure, and 44px controls.

---

### Task 1: Encode the verified prototype sequence in Playwright

**Files:**
- Modify: `tests/timeline.spec.ts`

**Interfaces:**
- Consumes: `[data-home-timeline]`, `[data-home-stage]`, and `[data-prototype-frame]` from the home scene controller.
- Produces: regression coverage for `hero`, `engineered`, `philosophy`, `tests`, and `newsletter-footer` frame states.

- [ ] Write failing browser checks for all five source frame identifiers, deterministic forward/reverse traversal, native wheel behavior, and normal-flow reduced motion.
- [ ] Run `npm run test:e2e -- tests/timeline.spec.ts` and confirm the old three-frame implementation fails.

### Task 2: Replace the timeline state boundary

**Files:**
- Modify: `src/components/storefront/home-scene.tsx`

**Interfaces:**
- Consumes: native `scroll` position and media queries.
- Produces: `HomeSceneController`, `HomeScene`, and `useHomeTimeline` with a `FrameId` union matching Task 1.

- [ ] Derive the settled frame index and bounded transition progress from the measured home track; never intercept input.
- [ ] Render all frames static and semantic under reduced motion or small viewport flow.
- [ ] Run the focused Playwright suite and confirm it passes.

### Task 3: Restore the source-backed frame content and navigation

**Files:**
- Modify: `src/components/storefront/home-view.tsx`
- Modify: `src/components/storefront/storefront-shell.tsx`

**Interfaces:**
- Consumes: Task 2 scene identifiers and existing local landing assets.
- Produces: Hero, Engineered, Philosophy, Three Tests, and Newsletter/Footer frame content.

- [ ] Restore exact visible prototype copy and the Contact Us home navigation link.
- [ ] Use the existing footer composition inside the final prototype frame; no newsletter integration is added.
- [ ] Remove the unsupported hand-drawn philosophy orbit.

### Task 4: Rebuild scene styling and document source gaps

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `docs/figma-audit.md`

**Interfaces:**
- Consumes: scenes from Task 3 and `data-frame-state` from Task 2.
- Produces: source-specific desktop transitions and responsive normal-flow layouts without horizontal overflow.

- [ ] Replace the old three-scene overlap CSS entirely.
- [ ] Use a black handoff for hero-to-engineered, the cream philosophy reveal, and the composed final newsletter/footer frame.
- [ ] Record unavailable exact philosophy orbit/back-image assets as an explicit deviation.

### Task 5: Verify in browser and across the project

**Files:**
- Update: `output/playwright/responsive/home-320.png`
- Update: `output/playwright/responsive/home-768.png`
- Update: `output/playwright/responsive/home-1024.png`
- Update: `output/playwright/responsive/home-1440.png`

- [ ] Capture comparison screenshots at 320, 768, 1024, and 1440 pixels.
- [ ] Verify keyboard, cart opening, and reduced motion in the live browser.
- [ ] Run lint, typecheck, Jest, build, database check, Playwright, and `py -m graphify update .`.
