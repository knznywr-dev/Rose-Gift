# 🌹 A Rose for Diday

A small, romantic, interactive 3D rose — built as a birthday gift. It opens
as a closed bud, blooms petal by petal, sways gently, and responds to touch.
It also includes a personal letter, a hidden surprise, optional photos and
soft ambient music.

Everything is a **static website**: plain HTML, CSS and JavaScript. There is
no database, no login, no build step and no npm. You can open it by
double-clicking `index.html`, and you can publish it for free with GitHub
Pages.

---

## 1. What the website does

- **A real 3D rose**, modelled procedurally in Three.js — curved petals,
  multiple layers, stem, leaves, thorns and sepals. It is not a picture or
  an emoji.
- **A cinematic bloom**: the bud opens from the outside in over about four
  seconds, with a soft glow.
- **Gentle life**: the stem sways, the petals breathe, sparkles twinkle and
  a few petals drift down the screen.
- **Drag / swipe to orbit** the rose and **scroll / pinch to zoom**.
- **Tap or hover a petal** to send a little ripple and sparkle through the
  flower.
- **Send Love** — a large sparkle burst, a petal ripple and a short camera
  push-in.
- **Read My Letter** — an elegant, keyboard-accessible letter modal.
- **A Little Surprise** — floating hearts, a sparkle burst and your own
  message.
- **Music** — off by default. A click starts either the built-in ambient
  synth or your own MP3.
- **Optional photo gallery** — hidden until you add photos.
- **Fallbacks** — if WebGL, GSAP or the CDN is unavailable, the page still
  appears with a painted rose and working letter / surprise / music.

---

## 2. Folder structure

```
rose-gift/
│
├── index.html              ← the page (open this)
├── README.md               ← this guide
├── .nojekyll               ← tells GitHub Pages not to process the files
├── .gitignore              ← keeps editor/OS junk out of the repo
│
├── css/
│   └── styles.css          ← all styling and responsive layout
│
├── js/
│   ├── config.js           ← ★ EDIT THIS: names, letter, colours, music
│   ├── main.js             ← startup, loading screen, error handling
│   ├── rose-scene.js       ← Three.js rose, lights, particles, bloom
│   ├── interactions.js     ← buttons, modals, gallery, tapping petals
│   └── audio.js            ← ambient synth + optional MP3
│
└── assets/
    ├── images/             ← your photos (see its README)
    ├── audio/              ← your optional song (see its README)
    └── favicon.svg         ← little rose browser-tab icon
```

**Important:** `index.html` must stay in the root of the folder. All paths
inside the project are relative (`css/styles.css`, `js/main.js`,
`assets/images/...`), so the site works both locally and inside a GitHub
repository subfolder such as `https://username.github.io/rose-gift/`.

---

## 3. Technologies used

| Technology | Why |
|---|---|
| HTML5 | Page structure and accessible dialogs |
| CSS3 | Layout, bokeh, gradients, grain, animations, responsive design |
| JavaScript (ES modules) | Application logic |
| [Three.js 0.160.0](https://threejs.org/) | WebGL 3D rose, lighting, particles |
| Three.js OrbitControls | Drag-to-rotate and zoom |
| [GSAP 3.12.5](https://gsap.com/) | Petal bloom easing and small flourishes |
| Web Audio API | Original generated ambient music |
| Google Fonts | Great Vibes + Cormorant Garamond |

No React, Vue, Angular, Node, PHP, database, Tailwind, Bootstrap, Vite,
npm install, paid API or tracking service is used. The only external
requests are the three versioned CDNs above and Google Fonts.

> **Offline note:** the first visit needs internet access for Three.js,
> GSAP and the fonts. If a CDN is blocked, the site falls back gracefully
> instead of hanging. After the browser caches the files, it may work
> briefly offline, but you should not rely on that.

---

## 4. Open the project in Visual Studio Code

1. Download and install **Visual Studio Code** from
   <https://code.visualstudio.com/>.
2. Open VS Code.
3. Choose **File → Open Folder…**
4. Select the **`rose-gift`** folder (the one containing `index.html`).
5. In the left sidebar you will see `index.html`, `css`, `js` and `assets`.

You do **not** need to install Node.js, npm or any package for this project.

---

## 5. Install and use Live Server

Live Server gives you a local address like `http://127.0.0.1:5500` and
refreshes the page when you save a file.

1. In VS Code, click the **Extensions** icon in the left sidebar
   (four small squares).
2. Search for **Live Server** (publisher: Ritwick Dey).
3. Click **Install**.
4. Open `index.html` in the editor.
5. Right-click anywhere inside the HTML and choose
   **Open with Live Server**.
6. Your browser opens the site automatically.

To stop it, right-click the editor again and choose **Stop Live Server**.

You can also just **double-click `index.html`** in File Explorer. Most
features work, but a local server is closer to how GitHub Pages behaves.

---

## 6. Preview the website locally

### Easiest way
Double-click `index.html`.

### Recommended way
Use Live Server (section 5), or run a tiny local server from a terminal in
the project folder:

```bash
# If you already have Python installed:
python -m http.server 8000
```

Then open <http://127.0.0.1:8000/>. (Python is only a convenient local
preview tool here; the website itself does not use Python.)

---

## 7. Personalize the name and messages

Everything personal lives in **one file**: `js/config.js`.

Open it and change the text inside the quotes:

```js
export const CONFIG = {
  name: "Diday",
  message: "Happy Birthday, Diday ❤️",
  subtitle: "Every petal holds a little wish for you.",
  // ...
};
```

- `name` appears in the small gold line (“A ROSE FOR …”) and in the tab
  title.
- `message` is the big script line.
- `subtitle` is the small italic line under the divider.

Save the file and refresh. The page text updates automatically — you do not
need to edit `index.html`.

### The letter

```js
loveLetter:
  "My dearest Diday,\n\n" +
  "First paragraph…\n\n" +
  "Second paragraph…",

letterSignature: "Always yours",
```

`\n\n` creates a new paragraph. Keep the quotes and the `+` signs.

### The surprise

```js
surpriseTitle: "A little surprise",
surpriseMessage: "You are my favourite person…",
```

All user text is inserted with `textContent`, so quotes, emoji and
punctuation are safe and cannot break the page.

---

## 8. Change the rose colours

In `js/config.js`:

```js
roseColor: "#a30c29",     // deep crimson body
roseTipColor: "#d23a56",  // lighter petal edges
```

Try:

| Mood | `roseColor` | `roseTipColor` |
|---|---|---|
| Classic red | `#a30c29` | `#d23a56` |
| Deep wine | `#6d0a1e` | `#a81f3c` |
| Soft pink | `#c94f72` | `#f2a0b6` |
| Coral | `#b83a3a` | `#ef7f74` |

Save and refresh. The inner petals are automatically kept a little darker
than the outer ones for depth.

---

## 9. Change the bloom duration

```js
bloomDuration: 3.8,   // seconds
```

- `3.0` is brisk.
- `3.8` is the default, natural pace.
- `5.0` is slow and dreamy.
- Values below ~2 seconds may feel abrupt.

If the visitor has **Reduce Motion** enabled in their operating system, the
site deliberately uses a much shorter bloom and calmer idle motion.

---

## 10. Add an MP3

1. Put a song you have the right to use into `assets/audio/`, for example
   `assets/audio/our-song.mp3`.
2. In `js/config.js`:

```js
musicUrl: "assets/audio/our-song.mp3",
musicVolume: 0.45,   // 0.0 – 1.0
```

Leave `musicUrl: ""` to use the built-in generative ambience. The music
never autoplays: it starts only when the visitor presses **Music**.

If the file is missing or cannot play, the site automatically switches to
the built-in synth and logs a warning in the browser console.

---

## 11. Add personal photographs

1. Copy your pictures into `assets/images/`.
2. In `js/config.js`:

```js
photos: [
  "assets/images/us-1.jpg",
  "assets/images/us-2.jpg",
],
```

Or with captions:

```js
photos: [
  { src: "assets/images/us-1.jpg", alt: "Our first trip" },
  { src: "assets/images/us-2.jpg", alt: "Your birthday last year" },
],
```

The **Our photos** button appears only when the array has at least one
valid entry. A photo that fails to load is removed automatically, so no
broken-image icons are shown. See `assets/images/README.md` for more.

---

## 12. Troubleshooting

### The loading screen stays for a long time
- Check your internet connection. Three.js, GSAP and the fonts come from
  CDNs.
- Wait a few seconds; a slow connection can take longer.
- After ~18–20 seconds a **Try again** button appears. Press it to reload.
- Open the browser console (`F12` → Console) to see which request failed.

### The rose is missing, but a painted rose and a note appear
This is the intentional fallback. It means WebGL could not start or the
Three.js CDN was blocked. The letter, surprise and music still work. Try
updating the browser, enabling hardware acceleration, or refreshing.

### The page looks unstyled
The CSS path is broken. Keep `index.html` at the project root and keep the
`css/` folder beside it. Do not rename `styles.css`.

### The letter button does nothing
Check the console for a JavaScript error. Make sure you did not remove a
comma or a quote in `js/config.js`.

### Music does not start
- Music starts only after you click the button (browser autoplay rules).
- If you added an MP3, confirm the exact file name and that it is inside
  `assets/audio/`.
- The built-in synth needs Web Audio; very old browsers may not support it.
  The button will show “audio unavailable”.

### Photos do not appear
- Confirm the files exist in `assets/images/`.
- Paths are case-sensitive on GitHub Pages: `Us-1.JPG` and `us-1.jpg` are
  different files.
- Check that `photos` is a real array with quotes around each path.

### The page is cut off on a small phone
The layout is responsive, but very short landscape screens hide the
subtitle and divider on purpose to keep the buttons reachable. If you add
a very long message, shorten it or test at 390 × 844 and 360 × 640.

### `file://` works but GitHub Pages does not
- `index.html` must be in the repository **root**, not inside a second
  `rose-gift/` folder.
- `.nojekyll` must be uploaded too (it is a hidden file; make sure your
  file manager shows hidden files).
- Wait 1–3 minutes after saving the Pages settings.

---

## 13. Publish for free with GitHub Pages

You do **not** need the command line or Git installed. The GitHub website
can upload the files for you.

> ⚠️ **Privacy warning:** a public GitHub repository and its GitHub Pages
> website are visible to anyone with the link. Anyone can also download the
> source and your images/audio. Do not upload private documents, passwords,
> API keys, or photos you would not want shared. The site collects no data
> and has no analytics, but the files themselves are public.

### Step 1 — Create a GitHub account
Go to <https://github.com/> and sign up or sign in.

### Step 2 — Create the repository
1. Click the **+** button in the top-right corner.
2. Choose **New repository**.
3. **Repository name:** `rose-gift`
4. **Description:** optional.
5. Choose **Public** (required for free GitHub Pages on a normal account).
6. Do **not** tick “Add a README file”, “Add .gitignore” or “Choose a
   license” — you already have files to upload.
7. Click **Create repository**.

### Step 3 — Upload the project
1. On the new empty repository page, click **uploading an existing file**
   (or **Add file → Upload files**).
2. Open your local `rose-gift` folder in File Explorer.
3. Select **everything inside it** — `index.html`, `README.md`,
   `.nojekyll`, `.gitignore`, the `css` folder, the `js` folder and the
   `assets` folder.
4. Drag them into the GitHub upload area.
5. **Critical:** do not upload the outer `rose-gift` folder itself. The
   repository root must contain `index.html` directly.
6. In the **Commit changes** box, type a message such as
   `Add rose gift website`.
7. Click **Commit changes**.

> **Hidden files:** `.nojekyll` and `.gitignore` start with a dot. In
> Windows File Explorer, turn on **View → Show → Hidden items** so you can
> select them. If your browser’s upload dialog hides dotfiles, you can
> create `.nojekyll` directly on GitHub with **Add file → Create new file**,
> name it `.nojekyll`, leave it empty, and commit.

### Step 4 — Turn on GitHub Pages
1. In the repository, click **Settings** (top menu).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment → Source**, choose
   **Deploy from a branch**.
4. Under **Branch**, select **main** (or `master` if that is your default).
5. Keep the folder as **`/ (root)`**.
6. Click **Save**.
7. Wait 1–3 minutes. Refresh the Pages screen until it shows
   “Your site is live at …”.

### Step 5 — Find and share the URL
Your address will look like:

```
https://YOUR-USERNAME.github.io/rose-gift/
```

For example, if your username is `alex`, it is
`https://alex.github.io/rose-gift/`.

- Open that URL on your computer to confirm it works.
- Send the same URL to your girlfriend. **She does not need a GitHub
  account** — it is a normal public web page.
- On a phone, open the link in Safari or Chrome and add it to the home
  screen if you like (Share → Add to Home Screen).
- If you update the site later, upload the changed files and commit again;
  GitHub Pages redeploys automatically in a minute or two.

### Common publishing mistakes
- **404 page:** `index.html` is not at the repository root, or Pages is
  still building. Check the file list on GitHub.
- **Unstyled page:** the `css` folder was not uploaded, or it is nested in
  another folder.
- **Old version showing:** wait a minute and hard-refresh
  (`Ctrl + Shift + R` / `Cmd + Shift + R`).
- **Images missing:** file names differ in capitalisation from `config.js`.

---

## 14. Accessibility & privacy notes

- Respects `prefers-reduced-motion` (calmer idle, shorter bloom, no
  floating hearts).
- Modals close with **Escape**, trap keyboard focus, and return focus to
  the button that opened them.
- All buttons are real `<button>` elements with visible focus rings.
- No accounts, cookies, analytics, tracking pixels, databases or external
  data collection.
- Everything is local except the documented CDNs and Google Fonts.

---

## 15. A quick customization checklist

- [ ] Change `name`, `message`, `subtitle` in `js/config.js`
- [ ] Write your own `loveLetter` and `letterSignature`
- [ ] Write your own `surpriseMessage`
- [ ] Pick `roseColor` / `roseTipColor`
- [ ] Set `bloomDuration` (3–4 seconds feels natural)
- [ ] Add an MP3 to `assets/audio/` and set `musicUrl` (optional)
- [ ] Add photos to `assets/images/` and list them in `photos` (optional)
- [ ] Test at phone size (390 × 844) and on a desktop
- [ ] Upload to GitHub, enable Pages, and share the URL

Enjoy — and happy birthday to Diday. 🌹
