/* ════════════════════════════════════════════════════════════════════════
   AUDIO
   ────────────────────────────────────────────────────────────────────────
   A soft, original ambient soundtrack generated live with the Web Audio
   API — no copyrighted file, no network request, no autoplay. If CONFIG
   sets musicUrl, that local MP3 is used instead; if it cannot load, the
   synth takes over automatically.

   Music always starts from a click, so it is autoplay-policy safe.
   ════════════════════════════════════════════════════════════════════════ */

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export function createAudio({ musicUrl = "", musicVolume = 0.45 } = {}) {
  const volume = clamp01(musicVolume);
  let ctx = null;
  let master = null;
  let filter = null;
  let timer = null;
  let audioEl = null;
  let started = false;
  let playing = false;
  let disposed = false;
  let nextChordAt = 0;
  let chordIndex = 0;
  let elementFade = 0;

  const CHORDS = [
    [45, 57, 60, 64, 71], // A minor 9
    [41, 53, 57, 60, 64], // F major 7
    [48, 55, 59, 64, 67], // C major 9
    [43, 55, 59, 62, 67], // G major
  ];

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(context, seconds, decay) {
    const rate = context.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = context.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function setupSynth() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio is not supported in this browser.");

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1250;
    filter.Q.value = 0.35;

    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.6, 2.4);

    filter.connect(dry);
    dry.connect(master);
    filter.connect(convolver);
    convolver.connect(wet);
    wet.connect(master);

    // slow movement in the filter cutoff
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 340;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    lfo.start();

    nextChordAt = ctx.currentTime + 0.12;
  }

  function schedule() {
    if (!ctx || !playing) return;
    const now = ctx.currentTime;
    while (nextChordAt < now + 3) {
      playChord(nextChordAt, CHORDS[chordIndex % CHORDS.length]);
      nextChordAt += 7.5;
      chordIndex++;
    }
  }

  function playChord(at, notes) {
    const dur = 8;

    notes.forEach((midi, index) => {
      const freq = midiToFreq(midi);
      const voices = index === 0
        ? [["sine", 0, 0.05], ["sine", -7, 0.03]]
        : [["sine", 0, 0.03], ["triangle", 7, 0.017]];

      voices.forEach(([type, detune, peak]) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(peak, at + 2.6);
        gain.gain.setValueAtTime(peak, at + dur - 2.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(at);
        osc.stop(at + dur + 0.1);
      });
    });

    // sparse music-box arpeggio shimmer
    const upper = notes.map((m) => m + 12);
    for (let k = 0; k < 5; k++) {
      if (Math.random() < 0.42) continue;
      const when = at + 1.1 + k * 1.2;
      const midi = upper[(k + ((Math.random() * upper.length) | 0)) % upper.length];
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midiToFreq(midi);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.02, when + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.5);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(when);
      osc.stop(when + 1.6);
    }
  }

  function fadeMaster(target, seconds) {
    if (!master || !ctx) return;
    const now = ctx.currentTime;
    const current = master.gain.value;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, current), now);
    master.gain.linearRampToValueAtTime(Math.max(0.0001, target), now + seconds);
  }

  function fadeElement(target, seconds, onDone) {
    if (!audioEl) return;
    cancelAnimationFrame(elementFade);
    const from = audioEl.volume;
    const startedAt = performance.now();
    const step = (now) => {
      if (!audioEl) return;
      const k = Math.min(1, (now - startedAt) / (seconds * 1000));
      audioEl.volume = from + (target - from) * k;
      if (k < 1) {
        elementFade = requestAnimationFrame(step);
      } else if (onDone) {
        onDone();
      }
    };
    elementFade = requestAnimationFrame(step);
  }

  function loadAudioElement(url) {
    return new Promise((resolve, reject) => {
      const el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      el.src = url;

      const timerId = window.setTimeout(() => {
        cleanup();
        reject(new Error("The audio file took too long to load."));
      }, 4500);

      const cleanup = () => {
        window.clearTimeout(timerId);
        el.removeEventListener("canplaythrough", onReady);
        el.removeEventListener("error", onError);
      };
      const onReady = () => {
        cleanup();
        resolve(el);
      };
      const onError = () => {
        cleanup();
        reject(new Error("The audio file could not be loaded."));
      };

      el.addEventListener("canplaythrough", onReady, { once: true });
      el.addEventListener("error", onError, { once: true });
      el.load();
    });
  }

  async function ensureStarted() {
    if (started) return;

    if (musicUrl) {
      try {
        audioEl = await loadAudioElement(musicUrl);
      } catch (err) {
        console.warn("Custom music unavailable, using the built-in ambience.", err);
        audioEl = null;
      }
    }

    if (!audioEl) setupSynth();
    started = true;
  }

  async function start() {
    if (disposed) throw new Error("Audio has been disposed.");
    await ensureStarted();

    if (audioEl) {
      try {
        audioEl.volume = 0;
        await audioEl.play();
        playing = true;
        fadeElement(volume, 1.8);
        return;
      } catch (err) {
        console.warn("MP3 playback failed, switching to the built-in ambience.", err);
        audioEl.pause();
        audioEl = null;
        setupSynth();
      }
    }

    if (!ctx) throw new Error("Audio could not be initialised.");
    if (ctx.state === "suspended") await ctx.resume();

    playing = true;
    nextChordAt = Math.max(nextChordAt, ctx.currentTime + 0.12);
    if (!timer) timer = window.setInterval(schedule, 500);
    schedule();
    fadeMaster(volume, 1.8);
  }

  function stop() {
    playing = false;
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    if (audioEl) {
      fadeElement(0, 0.8, () => {
        if (!playing && audioEl) audioEl.pause();
      });
    } else if (master) {
      fadeMaster(0.0001, 1);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    playing = false;
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
    cancelAnimationFrame(elementFade);
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
      audioEl = null;
    }
    if (ctx) {
      try {
        ctx.close();
      } catch {
        /* already closed */
      }
      ctx = null;
      master = null;
      filter = null;
    }
  }

  return {
    start,
    stop,
    dispose,
    isOn: () => playing,
  };
}
