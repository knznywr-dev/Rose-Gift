/* ════════════════════════════════════════════════════════════════════════
   INTERACTIONS
   ────────────────────────────────────────────────────────────────────────
   All page-level behaviour: filling the copy from CONFIG, the letter modal,
   the hidden surprise, the photo gallery, Send Love, the music toggle and
   tapping / hovering the 3D rose.

   The scene is passed in through a getter because it may be unavailable
   (no WebGL, CDN failure). Every scene call is optional, so the letter and
   other features keep working in the static fallback.
   ════════════════════════════════════════════════════════════════════════ */

const $ = (sel, root = document) => root.querySelector(sel);

/* Draw emoji a little smaller than the script lettering. */
function fillTitle(el, text) {
  el.textContent = "";
  const emojiRe = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;
  let last = 0;
  let match;
  while ((match = emojiRe.exec(text)) !== null) {
    if (match.index > last) el.appendChild(document.createTextNode(text.slice(last, match.index)));
    const span = document.createElement("span");
    span.className = "emoji";
    span.textContent = match[0];
    el.appendChild(span);
    last = match.index + match[0].length;
  }
  if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((photo, index) => {
      if (typeof photo === "string") {
        return { src: photo, alt: `A favourite memory, photo ${index + 1}` };
      }
      if (photo && typeof photo.src === "string") {
        return { src: photo.src, alt: photo.alt || `A favourite memory, photo ${index + 1}` };
      }
      return null;
    })
    .filter((photo) => photo && photo.src.trim());
}

export function initInteractions({ config, getScene, audio, gsap = null, reducedMotion = false }) {
  const controller = new AbortController();
  const signal = controller.signal;

  /* ── 1 · Copy from CONFIG ──────────────────────────────────────────── */
  const name = (config.name || "you").trim();
  $("#eyebrow").textContent = `A ROSE FOR ${name.toUpperCase()}`;
  fillTitle($("#title"), config.message || "");
  $("#subtitle").textContent = config.subtitle || "";
  const pageTitle = String(config.message || "A rose for you").replace(/❤️|❤/g, "").trim();
  document.title = pageTitle.toLowerCase().includes(name.toLowerCase())
    ? pageTitle
    : `${pageTitle} · for ${name}`;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", `A little interactive rose, blooming just for ${name}.`);

  /* ── 2 · Modal helpers (shared by letter, surprise, gallery) ───────── */
  const openModals = [];
  const closeTimers = new WeakMap();

  function focusables(modal) {
    return Array.from(
      modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function openModal(modal, opener) {
    const existingTimer = closeTimers.get(modal);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      closeTimers.delete(modal);
    }
    if (!modal.hidden && modal.classList.contains("is-open")) return;

    modal.hidden = false;
    modal.dataset.opener = opener ? "true" : "false";
    modal._opener = opener || document.activeElement;
    document.body.classList.add("modal-open");

    /* Force a style flush so the opening transition always plays, even on a
       slow device where requestAnimationFrame may be delayed. */
    void modal.offsetWidth;
    modal.classList.add("is-open");

    const first = modal.querySelector("[data-autofocus]") || focusables(modal)[0];
    if (first) first.focus({ preventScroll: true });

    if (!openModals.includes(modal)) openModals.push(modal);
  }

  function closeModal(modal) {
    const index = openModals.indexOf(modal);
    if (index !== -1) openModals.splice(index, 1);
    modal.classList.remove("is-open");
    if (!openModals.length) document.body.classList.remove("modal-open");

    const opener = modal._opener;
    if (opener && typeof opener.focus === "function") {
      opener.focus({ preventScroll: true });
    }

    const timer = window.setTimeout(() => {
      modal.hidden = true;
      closeTimers.delete(modal);
    }, reducedMotion ? 20 : 380);
    closeTimers.set(modal, timer);
  }

  document.addEventListener("keydown", (event) => {
    const modal = openModals[openModals.length - 1];
    if (!modal) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeModal(modal);
      return;
    }

    if (event.key === "Tab") {
      const items = focusables(modal);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, { signal });

  /* Wire every backdrop / close button marked data-close. */
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => closeModal(modal), { signal });
    });
  });

  /* ── 3 · Letter ────────────────────────────────────────────────────── */
  const letterModal = $("#letterModal");
  const letterBody = $("#letterBody");
  const letterSign = $("#letterSign");

  $("#letterTitle").textContent = config.letterTitle || "A letter for you";

  const paragraphs = String(config.loveLetter || "").split(/\n{2,}/);
  letterBody.textContent = "";
  paragraphs.forEach((text) => {
    if (!text.trim()) return;
    const p = document.createElement("p");
    p.textContent = text.trim();
    letterBody.appendChild(p);
  });
  letterSign.textContent = config.letterSignature ? `— ${config.letterSignature}` : "";
  letterSign.hidden = !config.letterSignature;

  const letterBtn = $("#letterBtn");
  letterBtn.addEventListener("click", () => openModal(letterModal, letterBtn), { signal });

  /* ── 4 · Surprise ──────────────────────────────────────────────────── */
  const surpriseModal = $("#surpriseModal");
  const surpriseHearts = $("#surpriseHearts");
  const surpriseTitle = $("#surpriseTitle");
  const surpriseMessage = $("#surpriseMessage");
  const surpriseBtn = $("#surpriseBtn");
  const replayBtn = $("#surpriseReplay");

  surpriseTitle.textContent = config.surpriseTitle || "A little surprise";
  surpriseMessage.textContent = config.surpriseMessage || "";

  function spawnHearts() {
    surpriseHearts.textContent = "";
    if (reducedMotion) return;
    const count = window.innerWidth < 640 ? 12 : 20;
    for (let i = 0; i < count; i++) {
      const heart = document.createElement("span");
      heart.className = "float-heart";
      heart.textContent = "❤";
      heart.setAttribute("aria-hidden", "true");
      heart.style.setProperty("--x", `${8 + Math.random() * 84}%`);
      heart.style.setProperty("--delay", `${Math.random() * 1.4}s`);
      heart.style.setProperty("--dur", `${3.2 + Math.random() * 2.6}s`);
      heart.style.setProperty("--size", `${10 + Math.random() * 22}px`);
      heart.style.setProperty("--drift", `${(Math.random() - 0.5) * 90}px`);
      surpriseHearts.appendChild(heart);
    }
  }

  function fireSurprise() {
    spawnHearts();
    const scene = getScene();
    if (scene) scene.burstAtBloom(1.05);
    if (gsap && !reducedMotion) {
      gsap.fromTo(
        "#surpriseCard",
        { scale: 0.96 },
        { scale: 1, duration: 0.55, ease: "back.out(1.6)", overwrite: true }
      );
    }
  }

  surpriseBtn.addEventListener("click", () => {
    openModal(surpriseModal, surpriseBtn);
    fireSurprise();
  }, { signal });
  replayBtn.addEventListener("click", fireSurprise, { signal });

  /* ── 5 · Send Love ─────────────────────────────────────────────────── */
  const loveBtn = $("#loveBtn");
  const heartIcon = loveBtn.querySelector(".heart-icon");

  loveBtn.addEventListener("click", () => {
    const scene = getScene();
    if (scene) {
      scene.celebrate(1.15);
    } else {
      spawnHearts();
    }

    heartIcon.classList.remove("is-popping");
    void heartIcon.offsetWidth;
    heartIcon.classList.add("is-popping");
    loveBtn.classList.add("is-loved");
    window.setTimeout(() => loveBtn.classList.remove("is-loved"), 900);
    window.setTimeout(() => heartIcon.classList.remove("is-popping"), 620);
  }, { signal });

  /* ── 6 · Music ─────────────────────────────────────────────────────── */
  const musicBtn = $("#musicBtn");
  const musicLabel = $("#musicLabel");

  function setMusicUI(on) {
    musicBtn.classList.toggle("is-on", on);
    musicBtn.setAttribute("aria-pressed", String(on));
    musicLabel.textContent = on ? "music on" : "music off";
  }

  musicBtn.addEventListener("click", async () => {
    if (!audio) {
      musicLabel.textContent = "audio unavailable";
      window.setTimeout(() => setMusicUI(false), 2200);
      return;
    }

    if (audio.isOn()) {
      audio.stop();
      setMusicUI(false);
      return;
    }

    musicBtn.disabled = true;
    try {
      await audio.start();
      setMusicUI(true);
    } catch (err) {
      console.warn("Music could not start:", err);
      setMusicUI(false);
      musicLabel.textContent = "audio unavailable";
      window.setTimeout(() => {
        if (!audio.isOn()) setMusicUI(false);
      }, 2400);
    } finally {
      musicBtn.disabled = false;
    }
  }, { signal });

  /* ── 7 · Photo gallery (only when photos exist) ────────────────────── */
  const photos = normalizePhotos(config.photos);
  const galleryBtn = $("#galleryBtn");
  const galleryModal = $("#galleryModal");
  const galleryGrid = $("#galleryGrid");
  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImg");
  const lightboxCaption = $("#lightboxCaption");

  function removePhotoFigure(figure) {
    figure.remove();
    if (!galleryGrid.querySelector(".photo")) {
      galleryBtn.hidden = true;
      if (galleryModal.classList.contains("is-open")) closeModal(galleryModal);
    }
  }

  if (photos.length) {
    galleryBtn.hidden = false;
    photos.forEach((photo, index) => {
      const figure = document.createElement("figure");
      figure.className = "photo";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "photo-button";
      button.setAttribute("aria-label", `Open photo ${index + 1}: ${photo.alt}`);

      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.alt;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => removePhotoFigure(figure), { once: true, signal });

      button.appendChild(img);
      button.addEventListener("click", () => {
        lightboxImg.src = photo.src;
        lightboxImg.alt = photo.alt;
        lightboxCaption.textContent = photo.alt;
        openModal(lightbox, button);
      }, { signal });

      figure.appendChild(button);
      galleryGrid.appendChild(figure);
    });

    galleryBtn.addEventListener("click", () => openModal(galleryModal, galleryBtn), { signal });
  } else {
    galleryBtn.hidden = true;
  }

  /* ── 8 · Rose pointer interaction ──────────────────────────────────── */
  const canvas = $("#scene");
  let tapCandidate = false;
  let tapPointerId = null;
  let downX = 0;
  let downY = 0;
  let downAt = 0;
  let lastHoverAt = 0;
  let lastHoverImpulse = 0;

  function resetTap() {
    tapCandidate = false;
    tapPointerId = null;
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const scene = getScene();
    if (!scene) return;
    tapCandidate = true;
    tapPointerId = event.pointerId;
    downX = event.clientX;
    downY = event.clientY;
    downAt = performance.now();
  }

  function onPointerMove(event) {
    if (tapCandidate && event.pointerId === tapPointerId) {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 9) {
        tapCandidate = false;
      }
    }

    if (event.pointerType !== "mouse" || event.buttons !== 0) return;
    const now = performance.now();
    if (now - lastHoverAt < 90) return;
    lastHoverAt = now;

    const scene = getScene();
    if (!scene) return;
    const hit = scene.pick(event.clientX, event.clientY);
    canvas.style.cursor = hit ? "pointer" : "grab";

    if (hit && now - lastHoverImpulse > 480) {
      lastHoverImpulse = now;
      scene.ripple(hit, 0.42);
    }
  }

  function onPointerUp(event) {
    if (!tapCandidate || event.pointerId !== tapPointerId) {
      resetTap();
      return;
    }
    const dist = Math.hypot(event.clientX - downX, event.clientY - downY);
    const held = performance.now() - downAt;
    const scene = getScene();

    if (scene && dist < 9 && held < 650) {
      const hit = scene.pick(event.clientX, event.clientY);
      if (hit) {
        scene.ripple(hit, 1.7);
        scene.burstAtBloom(0.5, 55);
      }
    }
    resetTap();
  }

  function onPointerCancel() {
    resetTap();
    canvas.style.cursor = "grab";
  }

  function onPointerLeave() {
    canvas.style.cursor = "grab";
  }

  if (canvas) {
    canvas.addEventListener("pointerdown", onPointerDown, { passive: true, signal });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true, signal });
    canvas.addEventListener("pointerleave", onPointerLeave, { passive: true, signal });
    canvas.addEventListener("pointercancel", onPointerCancel, { passive: true, signal });
    window.addEventListener("pointerup", onPointerUp, { passive: true, signal });
    window.addEventListener("blur", onPointerCancel, { signal });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true, signal });
  }

  /* ── 9 · Hint + reveal ─────────────────────────────────────────────── */
  const hint = $("#hint");
  const hintTimer = window.setTimeout(() => hint.classList.add("is-faded"), 11000);

  function reveal() {
    document.body.classList.add("is-revealed");
  }

  function dismissHint() {
    hint.classList.add("is-faded");
    window.clearTimeout(hintTimer);
  }
  window.addEventListener("pointerdown", dismissHint, { once: true, passive: true, signal });

  /* ── 10 · Cleanup ──────────────────────────────────────────────────── */
  function dispose() {
    window.clearTimeout(hintTimer);
    controller.abort();
    openModals.slice().forEach((modal) => {
      const timer = closeTimers.get(modal);
      if (timer) window.clearTimeout(timer);
    });
    openModals.length = 0;
    document.body.classList.remove("modal-open");
    if (audio) audio.dispose();
  }

  return { reveal, dispose };
}
