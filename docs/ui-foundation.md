# UI foundation: Tailwind v4 and shadcn/ui

Status: introduced as a controlled primitive layer on 2026-08-30. The public storefront remains custom CSS, editorial, and Figma-led.

## Ownership

- **Delta** owns the semantic CSS variables in `src/styles/globals.css`, all public storefront composition, typography, spacing, corners, shadows, and motion.
- **Tailwind v4** provides utility generation only. Its preflight reset is deliberately not imported: Delta's existing global CSS reset remains authoritative and avoids visual changes to the verified storefront.
- **shadcn/ui** owns accessible behavior primitives under `src/components/ui/`. Every primitive consumes semantic variables mapped from Delta tokens.

## Initial primitives

| Primitive | Why it exists | Current storefront replacement |
| --- | --- | --- |
| Dialog | Future confirmation and modal behavior | None; the cart drawer remains custom and tested |
| Sheet | Future responsive/admin side panels | None; explicitly not used for cart |
| Accordion | Consistent disclosure behavior | Available for future authored details |
| Select | Controlled listbox behavior when native select is insufficient | No migration in this task |
| Dropdown menu | Keyboard-safe action/menu primitive | None |
| Tooltip | Accessible supplementary labels | None |
| Sonner | Shared non-critical toast primitive | None; existing cart live announcements remain authoritative |
| Skeleton | Stable async placeholder primitive | Existing catalog skeleton remains unchanged |

## Dependency record

- `tailwindcss`, `@tailwindcss/postcss`, `postcss`: official Tailwind v4/PostCSS integration for generated primitive utilities. Build-time only; no browser runtime.
- `shadcn`: generator/maintenance CLI. Development-only; components remain project-owned source files.
- `class-variance-authority`, `clsx`, `tailwind-merge`: shadcn component variants and conflict-safe class composition.
- `lucide-react`: accessible default icon source required by the generated primitives; no storefront icon migration is included.
- `tw-animate-css`: shared small CSS keyframes used by shadcn disclosure/overlay state transitions.
- `sonner`: toast behavior primitive for future admin/complex interactions; not rendered on storefront in this task.
- Radix dependencies are installed transitively by the shadcn component generator and provide dialog, menu, select, tooltip, and accordion keyboard/focus behavior.

The added browser runtime is limited to primitives imported by a route. No primitive is mounted in the existing storefront during this foundation task, so the current public-route bundle does not take on their client behavior.

## Migration rule

Migrate a public component only with a documented accessibility or maintenance gain, screenshot comparison, and keyboard regression coverage. Forms, tables, command palette, tabs, and data grids remain reserved for approved admin work.
