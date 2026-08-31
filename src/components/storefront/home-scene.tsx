"use client";

import Image from "next/image";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

const INTRO_KEY = "delta-home-intro-seen";
const DESKTOP_QUERY = "(min-width: 64rem)";

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
  reducedMotion: false,
  intro: false,
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
    const translate = sceneId === "philosophy" ? -2 * transition : sceneId === "tests" ? -4 * transition : -1.5 * transition;
    return { opacity, translate, active: opacity > 0.02 };
  }

  const opacity = blackHandoff ? clamp((transition - 0.5) * 2) : transition;
  const translate = sceneId === "engineered" ? (1 - opacity) * 10 : sceneId === "tests" ? (1 - opacity) * 6 : sceneId === "newsletter-footer" ? (1 - opacity) * 4 : 0;
  return { opacity, translate, active: opacity > 0.02 };
}

export function HomeSceneController({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [intro, setIntro] = useState(false);

  useEffect(() => {
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

    syncPreferences();
    scheduleProgress();
    reduced.addEventListener("change", syncPreferences);
    desktop.addEventListener("change", syncPreferences);
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress);

    try {
      if (!reduced.matches && !window.sessionStorage.getItem(INTRO_KEY)) {
        window.requestAnimationFrame(() => setIntro(true));
        window.sessionStorage.setItem(INTRO_KEY, "true");
      }
    } catch { /* Session storage is unavailable; the initial false state is retained. */ }

    return () => {
      reduced.removeEventListener("change", syncPreferences);
      desktop.removeEventListener("change", syncPreferences);
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const isFlow = reducedMotion;
  const settledFrame = getSettledFrame(progress);
  const context = { progress, reducedMotion, intro: intro && !reducedMotion, settledFrame };
  const stageStyle = { "--timeline-progress": progress, "--home-frame-count": HOME_FRAME_IDS.length } as CSSProperties;

  return (
    <TimelineContext.Provider value={context}>
      <main ref={rootRef} className="home-page" aria-label="Delta landing scenes" data-home-timeline data-home-motion={isFlow ? "flow" : "scrubbed"} data-scroll-progress={progress.toFixed(4)}>
        <HomeIntro />
        <div className="prototype-track">
          <div className="prototype-viewport" data-home-stage data-settled-frame={settledFrame} style={stageStyle}>{children}</div>
        </div>
      </main>
    </TimelineContext.Provider>
  );
}

function HomeIntro() {
  const { progress, intro, reducedMotion } = useContext(TimelineContext);
  if (!intro || reducedMotion) return null;
  const opacity = clamp(1 - progress * 14);
  return <div className="home-intro" data-home-intro aria-hidden="true" style={{ opacity }}><Image className="home-intro-mark" src="/design-reference/assets/delta-logo.svg" alt="" width={336} height={84} priority unoptimized /></div>;
}

export function HomeScene({ sceneId, children, className = "", ...props }: { sceneId: FrameId; children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  const { progress, reducedMotion, settledFrame } = useContext(TimelineContext);
  const presentation = getFramePresentation(sceneId, progress, reducedMotion);
  const isSettled = reducedMotion || settledFrame === sceneId;
  const style = { "--frame-opacity": presentation.opacity, "--frame-translate": `${presentation.translate}%` } as CSSProperties;
  return <section {...props} className={`prototype-frame prototype-frame--${sceneId} ${className}`} data-prototype-frame={sceneId} data-frame-state={isSettled ? "settled" : presentation.active ? "transitioning" : "hidden"} aria-hidden={!isSettled && !reducedMotion ? true : undefined} inert={!isSettled && !reducedMotion ? true : undefined} style={style}>{children}</section>;
}
