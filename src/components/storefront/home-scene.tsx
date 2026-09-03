"use client";

import Image from "next/image";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

const INTRO_KEY = "delta-home-intro-seen";
const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * Runs before first paint, from a nonced <script> in (store)/page.tsx, and opts
 * the intro IN. Without it the overlay stays hidden, which is what a
 * scripting-off client and every repeat visit should see. Rendered on the server
 * so the intro is present at first paint instead of appearing after hydration.
 */
export const INTRO_BOOTSTRAP = `try{document.documentElement.dataset.homeIntroState=matchMedia("${DESKTOP_QUERY}").matches&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem("${INTRO_KEY}")?"play":"skip"}catch{document.documentElement.dataset.homeIntroState="skip"}`;

export const HOME_FRAME_IDS = ["hero", "engineered", "philosophy", "tests", "newsletter-footer"] as const;
export type FrameId = (typeof HOME_FRAME_IDS)[number];

type TimelineState = {
  progress: number;
  reducedMotion: boolean;
  intro: boolean;
  settledFrame: FrameId;
};

const TimelineContext = createContext<TimelineState>({
  progress: 0,
  reducedMotion: true,
  intro: true,
  settledFrame: "hero",
});

export function useHomeTimeline() {
  return useContext(TimelineContext);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function getSettledFrame(progress: number): FrameId {
  return HOME_FRAME_IDS[Math.min(HOME_FRAME_IDS.length - 1, Math.round(progress * (HOME_FRAME_IDS.length - 1)))];
}

/**
 * Named scrub intents, one per frame - the deck's only motion constants.
 * `exit` is the translateY percentage the outgoing frame drifts to, `enter` the
 * one the incoming frame arrives from. Every frame rests at translate 0 /
 * opacity 1, and reduced motion returns that resting state directly.
 */
const FRAME_MOTION: Record<FrameId, { exit: number; enter: number }> = {
  hero: { exit: 1.5, enter: 0 },
  engineered: { exit: 1.5, enter: 10 },
  philosophy: { exit: 2, enter: 0 },
  tests: { exit: 4, enter: 6 },
  "newsletter-footer": { exit: 1.5, enter: 4 },
};

function getFramePresentation(sceneId: FrameId, progress: number, reducedMotion: boolean) {
  if (reducedMotion) return { opacity: 1, translate: 0, active: true };

  const index = HOME_FRAME_IDS.indexOf(sceneId);
  const position = progress * (HOME_FRAME_IDS.length - 1);
  const settledIndex = Math.min(HOME_FRAME_IDS.length - 1, Math.round(position));
  if (Math.abs(position - settledIndex) <= 0.25) {
    return { opacity: index === settledIndex ? 1 : 0, translate: 0, active: index === settledIndex };
  }

  const previousIndex = Math.floor(position);
  const nextIndex = Math.min(HOME_FRAME_IDS.length - 1, previousIndex + 1);
  const transition = clamp((position - (previousIndex + 0.25)) / 0.5);
  const blackHandoff = previousIndex === 0 && nextIndex === 1;

  if (index !== previousIndex && index !== nextIndex) return { opacity: 0, translate: 0, active: false };
  if (previousIndex === nextIndex) return { opacity: index === previousIndex ? 1 : 0, translate: 0, active: index === previousIndex };

  if (index === previousIndex) {
    const opacity = blackHandoff ? clamp(1 - transition * 2) : 1 - transition;
    const translate = -FRAME_MOTION[sceneId].exit * transition;
    return { opacity, translate, active: opacity > 0.02 };
  }

  const opacity = blackHandoff ? clamp((transition - 0.5) * 2) : transition;
  const translate = (1 - opacity) * FRAME_MOTION[sceneId].enter;
  return { opacity, translate, active: opacity > 0.02 };
}

/**
 * Frame i settles at progress i/(n-1). The deck has no scroll box of its own - the
 * frames are absolutely positioned inside a sticky viewport, so scrollIntoView
 * computes a near-zero delta for anything inside them. Everything that wants to
 * reach a frame has to convert it back into a page offset itself.
 */
function scrollToFrame(root: HTMLElement, frameId: FrameId) {
  const scrollRange = Math.max(root.offsetHeight - window.innerHeight, 1);
  const share = HOME_FRAME_IDS.indexOf(frameId) / (HOME_FRAME_IDS.length - 1);
  window.scrollTo({ top: window.scrollY + root.getBoundingClientRect().top + share * scrollRange });
}

/** Scrolls the deck to the frame owning `id`. False when the deck is not driving
 *  the page, which leaves plain anchor behaviour to do the right thing in flow. */
export function scrollToHomeFragment(id: string) {
  const root = document.querySelector<HTMLElement>("[data-home-timeline]");
  const frameId = document.getElementById(id)?.closest<HTMLElement>("[data-prototype-frame]")?.dataset.prototypeFrame;
  if (!root || !frameId || root.dataset.homeMotion !== "scrubbed") return false;
  scrollToFrame(root, frameId as FrameId);
  return true;
}

/**
 * Set once the intro has mounted in this document. Client navigation remounts the
 * controller, and re-rendering the overlay there left its visibility depending on
 * whether the previous unmount's cleanup had already written data-home-intro-state
 * — a race that intermittently flashed the intro on the way back to "/". Reading
 * it only on the client keeps SSR unaffected: the server must always render the
 * overlay, and this module is shared across server requests.
 */
let introMountedInDocument = false;

export function HomeSceneController({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const introStartedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  // Starts flowing, not scrubbing. The deck is progressive enhancement, so the
  // state the server renders - and the state a scripting-off client keeps - has to
  // be the one where every frame is settled, visible and reachable. syncPreferences
  // promotes it to the scrub on the first client frame.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [intro, setIntro] = useState(() => typeof window === "undefined" || !introMountedInDocument);

  useEffect(() => {
    const root = rootRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const isFlow = () => reduced.matches || !desktop.matches;
    const syncPreferences = () => setReducedMotion(isFlow());
    const syncProgress = () => {
      const root = rootRef.current;
      if (!root || isFlow()) {
        setProgress(0);
        return;
      }
      const scrollRange = Math.max(root.offsetHeight - window.innerHeight, 1);
      setProgress(clamp(-root.getBoundingClientRect().top / scrollRange));
    };
    const scheduleProgress = () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        syncProgress();
      });
    };

    // Frames stay focusable while scrubbed - hiding them is what stranded the
    // keyboard below the hero - so a Tab can land on a frame that is off screen.
    // The deck follows the user's focus; a plain scroll never moves their focus.
    const followFocus = (event: FocusEvent) => {
      const frame = (event.target as Element | null)?.closest<HTMLElement>("[data-prototype-frame]");
      if (!root || !frame || isFlow() || frame.dataset.frameState === "settled") return;
      scrollToFrame(root, frame.dataset.prototypeFrame as FrameId);
    };

    syncPreferences();
    scheduleProgress();
    root?.addEventListener("focusin", followFocus);
    reduced.addEventListener("change", syncPreferences);
    desktop.addEventListener("change", syncPreferences);
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress);
    // Set on the node rather than through state: it flips once, never renders
    // anything, and React leaves the attribute alone because its own value for it
    // never changes. Tests wait on it to know the scroll listener exists — the
    // progress value alone cannot say, since it is already correct at rest.
    root?.setAttribute("data-timeline-ready", "true");

    try {
      introMountedInDocument = true;
      const shouldPlayIntro = introStartedRef.current || (!isFlow() && !window.sessionStorage.getItem(INTRO_KEY));
      introStartedRef.current = shouldPlayIntro;
      setIntro(shouldPlayIntro);
      document.documentElement.dataset.homeIntroState = shouldPlayIntro ? "play" : "skip";
      if (shouldPlayIntro) {
        window.sessionStorage.setItem(INTRO_KEY, "true");
      }
    } catch {
      setIntro(false);
      document.documentElement.dataset.homeIntroState = "skip";
    }

    return () => {
      root?.removeEventListener("focusin", followFocus);
      reduced.removeEventListener("change", syncPreferences);
      desktop.removeEventListener("change", syncPreferences);
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      document.documentElement.dataset.homeIntroState = "skip";
    };
  }, []);

  const isFlow = reducedMotion;
  const settledFrame = getSettledFrame(progress);
  const context = { progress, reducedMotion, intro, settledFrame };
  const stageStyle = { "--timeline-progress": progress, "--home-frame-count": HOME_FRAME_IDS.length } as CSSProperties;

  return (
    <TimelineContext.Provider value={context}>
      <main ref={rootRef} className="home-page" aria-label="Delta landing scenes" data-home-timeline data-home-motion={isFlow ? "flow" : "scrubbed"} data-scroll-progress={progress.toFixed(4)} data-timeline-ready="false">
        <HomeIntro />
        <div className="prototype-track">
          <div className="prototype-viewport" data-home-stage data-settled-frame={settledFrame} style={stageStyle}>{children}</div>
        </div>
      </main>
    </TimelineContext.Provider>
  );
}

function HomeIntro() {
  const { progress, intro } = useContext(TimelineContext);
  // `intro` starts true so the overlay is in the server-rendered HTML and is
  // therefore present at first paint rather than popping in after hydration.
  // The mount effect flips it to whether the intro should actually play, which
  // unmounts it for a repeat visit, a flow viewport or reduced motion. Before
  // hydration - and with scripting off - CSS keeps it hidden unless the nonced
  // bootstrap has opted in.
  //
  // `played` retires the overlay when its dissolve ends. Without it the element
  // stayed mounted for the life of the page: home-intro-dissolve leaves it at
  // opacity 0, but home-intro-mark-arrive ends on scale(102) with `fill: both`,
  // so the mark kept painting at roughly 30,000 x 7,500 px - a permanent
  // full-screen composited layer that every later paint, scroll and hit-test on
  // the home page had to carry. Driven by the animation's own animationend
  // event, so the timing comes from the animation rather than from a guess, and
  // the animation itself is untouched.
  const [played, setPlayed] = useState(false);
  if (!intro || played) return null;
  const opacity = clamp(1 - progress * 14);
  const retireWhenDissolved = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === "home-intro-dissolve") setPlayed(true);
  };
  return <div className="home-intro" data-home-intro aria-hidden="true" style={{ opacity }} onAnimationEnd={retireWhenDissolved}><Image className="home-intro-mark" src="/design-reference/assets/delta-logo.svg" alt="" width={336} height={84} priority unoptimized /></div>;
}

export function HomeScene({ sceneId, children, className = "", ...props }: { sceneId: FrameId; children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  const { progress, reducedMotion, settledFrame } = useContext(TimelineContext);
  const presentation = getFramePresentation(sceneId, progress, reducedMotion);
  const isSettled = reducedMotion || settledFrame === sceneId;
  const style = { "--frame-opacity": presentation.opacity, "--frame-translate": `${presentation.translate}%` } as CSSProperties;
  return <section {...props} className={`prototype-frame prototype-frame--${sceneId} ${className}`} data-prototype-frame={sceneId} data-frame-state={isSettled ? "settled" : presentation.active ? "transitioning" : "hidden"} style={style}>{children}</section>;
}
