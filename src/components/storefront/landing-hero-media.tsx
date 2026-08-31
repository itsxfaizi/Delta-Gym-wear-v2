"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useHomeTimeline } from "./home-scene";

const HERO_POSTER = "/design-reference/assets/landing/hero-run.png";
const HERO_VIDEO = "/design-reference/assets/landing/hero-run.mp4";

export function LandingHeroMedia() {
  const [canAnimate, setCanAnimate] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { progress, reducedMotion } = useHomeTimeline();

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCanAnimate(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const heroActive = !reducedMotion && progress < 0.48;
    if (heroActive) { void video.play().catch(() => undefined); } else { video.pause(); }
  }, [progress, reducedMotion]);

  return (
    <div className="landing-hero-media" aria-hidden="true">
      <Image
        className="landing-hero-poster"
        src={HERO_POSTER}
        alt=""
        fill
        sizes="100vw"
        priority
      />
      {canAnimate && !reducedMotion ? <video ref={videoRef} className="landing-hero-video" src={HERO_VIDEO} autoPlay loop muted playsInline poster={HERO_POSTER} preload="metadata" /> : null}
    </div>
  );
}
