"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { OpeningCurtain } from "./opening-curtain";

/** Give up holding if a clicked navigation never commits (offline, aborted, errored). */
const HOLD_TIMEOUT_MS = 10_000;

/**
 * Plays the bolt-zoom curtain on first load and on every storefront route switch.
 *
 * A route switch has two beats. The click raises the black wordmark field immediately
 * (`hold`), so the user sees the loader rather than a frozen page while the server renders.
 * When the new pathname commits, the curtain is remounted and the full zoom-and-lift plays
 * over the new page. Programmatic navigations and back/forward skip the hold and only play.
 *
 * Inert throughout (aria-hidden, pointer-events: none), and hidden under reduced motion by
 * opening-curtain.css, so it never gates content or focus.
 */
export function RouteCurtain() {
  const pathname = usePathname();
  const [run, setRun] = useState({ key: 0, phase: "play" as "hold" | "play", fromHold: false });
  const firstPathname = useRef(pathname);

  useEffect(() => {
    if (pathname === firstPathname.current) return;
    firstPathname.current = pathname;
    setRun((current) => ({ key: current.key + 1, phase: "play", fromHold: current.phase === "hold" }));
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setRun((current) => ({ ...current, phase: "hold" }));
    };
    // Capture phase: next/link calls preventDefault() on its own click, so by the bubble
    // phase every client-side navigation looks like a cancelled click.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (run.phase !== "hold") return;
    const timeout = window.setTimeout(() => setRun((current) => ({ key: current.key + 1, phase: "play", fromHold: true })), HOLD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [run.phase]);

  return <OpeningCurtain key={run.key} phase={run.phase} fromHold={run.fromHold} />;
}
