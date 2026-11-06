# assets/audio

The website already has a soft, original ambient soundtrack generated in
the browser with the Web Audio API. You do **not** need to add anything here.

If you want to use your own song instead:

1. Copy an MP3 you have the right to use into this folder, for example:

   ```
   assets/audio/our-song.mp3
   ```

2. Open `js/config.js` and set:

   ```js
   musicUrl: "assets/audio/our-song.mp3",
   ```

3. Keep `musicVolume` around `0.35`–`0.5` so it sits under the visuals.

If the file is missing, blocked, or cannot be played, the website
automatically falls back to its built-in ambience.

## Important

Do not download or include copyrighted music. Use a song you own, a
royalty-free track, or the built-in synth. Also remember that everything
in a public GitHub repository can be downloaded by anyone.
