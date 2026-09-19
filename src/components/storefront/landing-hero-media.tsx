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
 * Its pause control stays out of the visual composition, but remains keyboard and screen-reader
 * accessible for WCAG 2.2.2.
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
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : null}
      </div>
      {motionAllowed ? (
        <button type="button" className="motion-accessibility-toggle" onClick={toggle}>
          {playing ? "Pause background video" : "Play background video"}
        </button>
      ) : null}
    </>
  );
}
