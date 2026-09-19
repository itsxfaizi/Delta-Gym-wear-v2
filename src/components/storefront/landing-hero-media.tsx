"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const HERO_POSTER = "/design-reference/assets/landing/hero-run.png";
const HERO_VIDEO = "/design-reference/assets/landing/hero-run.mp4";

/**
 * Hero media for state 3 (64:5965). The poster is the LCP candidate and is server-rendered
 * with `priority`; the looping clip is layered on top only once the client confirms motion
 * is allowed, so reduced-motion users never download or paint it.
 *
 * WCAG 2.2.2 (Pause, Stop, Hide): the clip auto-plays and loops for longer than 5s, so it
 * carries a visible pause control. Suppressing it under prefers-reduced-motion does not
 * satisfy 2.2.2 on its own — the control is required for everyone who sees the motion.
 */
export function LandingHeroMedia() {
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionAllowed(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  // The media layer sits at z-index -2 behind the hero copy, so the control cannot live inside it.
  // It renders as a sibling and positions against `.landing-hero` (position: relative).
  return (
    <>
      <div className="landing-hero-media" aria-hidden="true">
        <Image className="landing-hero-poster" src={HERO_POSTER} alt="" fill sizes="100vw" priority />
        {motionAllowed ? (
          <video
            ref={videoRef}
            className="landing-hero-video"
            src={HERO_VIDEO}
            autoPlay
            loop
            muted
            playsInline
            poster={HERO_POSTER}
            preload="metadata"
            // Keep the label in sync with the real element state, not just our click handler.
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : null}
      </div>
      {motionAllowed ? (
        <button type="button" className="landing-hero-motion-toggle" onClick={toggle}>
          {playing ? "Pause background video" : "Play background video"}
        </button>
      ) : null}
    </>
  );
}
