/**
 * The hero film, shared by the preloader and the hero so the two are literally
 * the same picture: the entrance dissolves into the first frame instead of
 * cutting to it.
 */
const VERSION = "2026-10-23d";

export const FILM = {
  desktop: `/film/hero-scrub-1152.mp4?v=${VERSION}`,
  mobile: `/film/hero-scrub-896.mp4?v=${VERSION}`,
  poster: `/film/hero-poster.jpg?v=${VERSION}`,
  posterBlur: `/film/hero-poster-blur.jpg?v=${VERSION}`,
};

/**
 * A 5 MB film is the right thing to send to a phone on Wi-Fi and the wrong
 * thing to send to one that has asked for less data. When the browser tells us
 * the reader is on a metered or low-memory device, the hero keeps its poster
 * (the first frame) and never requests the clip.
 */
export const prefersLightData = () => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType === "slow-2g") return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 1) return true;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-data: reduce)").matches
  );
};

/** Chosen on the first render, so the element never reloads mid-scroll. */
export const preferredSource = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches
    ? FILM.desktop
    : FILM.mobile;
