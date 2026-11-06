# assets/images

Put your personal photos in this folder, then list them in `js/config.js`.

## 1. Add the files

Copy the pictures here with simple names, for example:

```
assets/images/us-at-the-beach.jpg
assets/images/birthday-2025.jpg
assets/images/our-first-date.png
```

JPG, PNG and WebP all work. Keep each file reasonably small (under ~1 MB)
so the page stays quick on a phone. You can resize photos with any free
image editor or an online resizer.

## 2. Tell the website about them

Open `js/config.js` and change the `photos` array:

```js
photos: [
  "assets/images/us-at-the-beach.jpg",
  "assets/images/birthday-2025.jpg",
  "assets/images/our-first-date.png",
],
```

For captions, use the longer form:

```js
photos: [
  { src: "assets/images/us-at-the-beach.jpg", alt: "Our first trip together" },
  { src: "assets/images/birthday-2025.jpg", alt: "Your birthday last year" },
],
```

## Notes

- If `photos` is `[]`, the **Our photos** button stays hidden.
- A photo that fails to load is removed automatically, so visitors never
  see a broken-image icon.
- Photos are **public** once the site is on GitHub Pages. Do not add
  anything private or embarrassing unless you are happy for it to be
  visible to anyone with the link.
