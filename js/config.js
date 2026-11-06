/* ════════════════════════════════════════════════════════════════════════
   A ROSE FOR DIDAY · PERSONALIZATION FILE
   ────────────────────────────────────────────────────────────────────────
   This is the only file you need to edit to make the gift your own.
   Change the text between the quotes, save, and refresh the page.

   Tips:
   • Keep the quotes around every value.
   • Hex colours look like "#a30c29" (a red) or "#d23a56" (a pink red).
   • Use \n inside loveLetter to start a new line, or leave a blank line
     between paragraphs by typing \n\n.
   • If musicUrl is "", the website plays its own soft, royalty-free
     ambient music. Set it to "assets/audio/your-song.mp3" to use a file.
   • photos stays [] until you add real pictures. See assets/images/README.md.
   ════════════════════════════════════════════════════════════════════════ */

export const CONFIG = {
  /* ── Who this is for ────────────────────────────────────────────────── */
  name: "Diday",

  /* The big script line. Emoji are automatically drawn a little smaller. */
  message: "Happy Birthday, Diday ❤️",

  /* The small italic line underneath. */
  subtitle: "Every petal holds a little wish for you.",

  /* ── The rose ───────────────────────────────────────────────────────── */
  roseColor: "#a30c29",       // deep crimson body of the petals
  roseTipColor: "#d23a56",    // lighter glow along the petal edges
  bloomDuration: 3.8,         // seconds for the full bloom (try 3–4)

  /* ── Music ──────────────────────────────────────────────────────────── */
  musicUrl: "",               // "" = built-in ambience, or "assets/audio/song.mp3"
  musicVolume: 0.45,          // 0.0 – 1.0

  /* ── The letter ─────────────────────────────────────────────────────── */
  letterTitle: "A letter for you",

  loveLetter:
    "My dearest Diday,\n\n" +
    "I built this little rose for you because some feelings are too big " +
    "for a text message. Every petal here opened thinking of you — of your " +
    "laugh, your kindness, and the way ordinary days feel softer when " +
    "you're in them.\n\n" +
    "Thank you for being my calm and my favourite kind of chaos. I hope " +
    "this year brings you everything you quietly wish for, and a few " +
    "beautiful surprises you didn't even know to ask for.\n\n" +
    "Happy birthday, my love. This rose will keep blooming for you.",

  letterSignature: "Always yours \n Kenz",

  /* ── The hidden surprise ────────────────────────────────────────────── */
  surpriseTitle: "A little surprise",

  surpriseMessage:
    "You are my favourite person, my safest place, and the best part of " +
    "every ordinary day. I love you — today, tomorrow, and forever ",

  /* ── Optional photo gallery ─────────────────────────────────────────── */
  /* Add file names from assets/images/ here. Both forms work:
       photos: ["assets/images/us-1.jpg", "assets/images/us-2.jpg"]
       photos: [{ src: "assets/images/us-1.jpg", alt: "Our first trip" }]
     Leave the array empty to hide the gallery completely. */
  photos: ["assets/images/us-1.jpg", "assets/images/us-2.jpg", "assets/images/us-3.jpg"],
};
