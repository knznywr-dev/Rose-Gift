/* ════════════════════════════════════════════════════════════════════════
   MAIN
   ────────────────────────────────────────────────────────────────────────
   Boots the page: fills the UI, loads GSAP and Three.js, starts the scene,
   and gets out of the way. Every dependency has a timeout and every failure
   has a friendly fallback, so the loading screen can never trap the page.
   ════════════════════════════════════════════════════════════════════════ */

import { CONFIG } from "./config.js";
import { createAudio } from "./audio.js";
import { initInteractions } from "./interactions.js";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOBILE = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;

const canvas = document.getElementById("scene");
const loader = document.getElementById("loader");
const loaderNote = loader ? loader.querySelector(".loader-note") : null;
const loaderRetry = document.getElementById("loaderRetry");
const fallbackNote = document.getElementById("fallbackNote");

let sceneApi = null;
let interactions = null;
let audio = null;
let finished = false;
let fallbackShown = false;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function timeout(ms, message) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms);
  });
}

function setLoaderNote(text) {
  if (loaderNote) loaderNote.textContent = text;
}

function showLoaderError(text) {
  if (loader) loader.classList.add("is-error");
  if (loaderRetry) loaderRetry.hidden = false;
  setLoaderNote(text);
}

function hideLoader() {
  if (!loader) return;
  loader.classList.add("is-hidden");
  window.setTimeout(() => {
    if (loader && loader.parentNode) loader.remove();
  }, 1600);
}

function revealSite() {
  if (interactions) interactions.reveal();
  else document.body.classList.add("is-revealed");
}

/* The static rose is shown by CSS when this class is present. */
function showFallback(message) {
  if (fallbackShown) return;
  fallbackShown = true;
  finished = true;
  window.__roseReady = true;

  document.body.classList.add("webgl-fallback");
  if (canvas) canvas.classList.add("is-hidden");
  if (fallbackNote) {
    fallbackNote.hidden = false;
    fallbackNote.textContent = message;
  }
  if (loader) loader.classList.remove("is-error");
  hideLoader();
  /* Reveal immediately: the CSS transition delays handle the choreography,
     so nothing depends on a timer that a busy device might delay. */
  revealSite();
}

/* ── 1 · UI first (works even if 3D never loads) ─────────────────────── */
audio = createAudio({
  musicUrl: CONFIG.musicUrl,
  musicVolume: CONFIG.musicVolume,
});

interactions = initInteractions({
  config: CONFIG,
  getScene: () => sceneApi,
  audio,
  gsap: window.gsap || null,
  reducedMotion: REDUCED,
});

/* ── 2 · Dependency helpers ──────────────────────────────────────────── */
function webglSupported() {
  try {
    if (!window.WebGLRenderingContext) return false;
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl2") || test.getContext("webgl");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

/* GSAP is loaded dynamically so a blocked CDN can never stall the page. */
function loadGsap(timeoutMs = 2800) {
  return new Promise((resolve) => {
    if (window.gsap) {
      resolve(window.gsap);
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => finish(window.gsap || null), { once: true });
    script.addEventListener("error", () => finish(null), { once: true });
    document.head.appendChild(script);

    window.setTimeout(() => finish(window.gsap || null), timeoutMs);
  });
}

function waitForFonts(ms = 1400) {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve();
  return Promise.race([document.fonts.ready, sleep(ms)]);
}

/* ── 3 · Boot sequence ───────────────────────────────────────────────── */
async function boot() {
  if (!webglSupported()) {
    showFallback(
      "Your browser or device could not start WebGL, so here is a painted rose instead. Everything else — the letter, the surprise and the music — still works."
    );
    return;
  }

  setLoaderNote("");

  const gsapPromise = loadGsap();
  const importPromise = Promise.race([
    import("./rose-scene.js"),
    timeout(15000, "The 3D engine took too long to load."),
  ]);

  try {
    const [module, gsap] = await Promise.all([importPromise, gsapPromise]);
    if (!gsap) {
      console.warn("GSAP was unavailable — the rose uses its built-in animation fallback.");
    }

    const createRoseScene = module.createRoseScene;
    if (typeof createRoseScene !== "function") {
      throw new Error("The 3D scene module did not load correctly.");
    }

    sceneApi = createRoseScene({
      canvas,
      config: CONFIG,
      gsap: gsap || null,
      mobile: MOBILE,
      reducedMotion: REDUCED,
      onContextLost: () => {
        sceneApi = null;
        showFallback(
          "The 3D view lost its graphics context. Your letter, surprise and music are still here, and refreshing the page will bring the rose back."
        );
      },
    });

    await waitForFonts(1400);
    if (finished) return;

    sceneApi.start();
    canvas.classList.add("is-visible");
    finished = true;
    window.__roseReady = true;
    hideLoader();
    /* Synchronous reveal — no timer to be throttled on a slow phone. */
    revealSite();
  } catch (err) {
    console.error("The rose could not start:", err);
    sceneApi = null;
    showFallback(
      "The 3D rose could not load — usually a slow or blocked internet connection to the Three.js CDN. A painted rose will keep you company, and the letter, surprise and music all still work. Refresh to try again."
    );
  }
}

/* ── 4 · Safety nets ─────────────────────────────────────────────────── */
if (loaderRetry) {
  loaderRetry.addEventListener("click", () => window.location.reload());
}

window.setTimeout(() => {
  if (finished) return;
  showLoaderError(
    "Still gathering petals… If this stays here, check your internet connection — the 3D engine, animation library and fonts load from CDNs."
  );
}, 18000);

/* If the browser cannot even fetch the ES modules, keep the page honest. */
window.addEventListener("error", (event) => {
  if (event && event.target && event.target.tagName === "SCRIPT") {
    console.warn("A script failed to load:", event.target.src);
  }
});

window.addEventListener("pagehide", (event) => {
  /* Keep everything alive when the page goes into the back/forward cache,
     so returning to it does not show a dead canvas. */
  if (event.persisted) return;
  if (interactions) interactions.dispose();
  if (sceneApi) sceneApi.dispose();
  sceneApi = null;
});

console.log(
  "%c🌹 A rose for " + CONFIG.name,
  "color:#ff8da6;font-size:16px;",
  "— edit js/config.js to personalise this gift."
);

boot();
