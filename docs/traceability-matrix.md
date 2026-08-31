# Delta Gym Wear — Traceability Matrix

| Route/component | Requirement | Authoritative source | Responsive evidence | Accessibility | Status/tests | Deviations/gaps |
| --- | --- | --- | --- | --- | --- | --- |
| Catalog `/` | Browse published products | Figma frame 10 export; Catalog Normal/Hover crops | 1440 source; 320/768/1024 derived | headings, labelled filters, focus, touch targets | Implemented; Jest + Playwright smoke; responsive screenshots | One product crop family only; filter/category semantics remain source-neutral simplification |
| Product detail `/products/[handle]` | View product and select colour/size | Figma frame 14 export; Image crops; icons | 1440 source; mobile/tablet derived | fieldsets, labelled controls, unavailable errors, focus | Implemented; Playwright unavailable-variant test | Size guide/zoom/quantity source behavior incomplete or deferred |
| Cart drawer | Add/update/remove cart lines | Figma frame 13 export; cart icons | 1440 source; drawer width derived | dialog semantics, focus trap/restore, Escape, live announcements | Implemented; Playwright journey test | Checkout action intentionally excluded |
| Navigation/header | Public navigation and cart trigger | Figma Nav evidence; dark logo SVG | Desktop source; compact header derived | labelled icon buttons, skip link, visible focus | Implemented as shared shell | Mobile nav behavior not authored |
| Circles motion | Authored landing motion | Figma motion inspection only; invalid 1×1 exports | None | reduced-motion static frame required | Blocked | Valid motion and resting frame missing |
| Home/landing | Brand/landing route | Figma explorations, no approved route frame | None | Unknown | Blocked | Route identity, responsive evidence, motion/assets |
| Collections/search/policies/footer expansion | Future confirmed surfaces | No complete approved local source | None | Unknown | Blocked | Exact route, content, behavior, responsive evidence |
| Admin publishing | Draft/edit/preview/publish/unpublish/history | `docs/admin-route-spec.md`; no Figma frames | None | Unknown | Deferred | Requires admin source or approved deviation |

Source hierarchy: approved Figma export/context → authoritative user artifact → approved documented deviation → blocked.
