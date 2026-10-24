# Jumping Jack

An EyeToy-style party game that runs entirely in the browser. The laptop's webcam watches you, MediaPipe pose tracking finds your head, hands, knees and feet, and you play by moving. There are no buttons: hold a hand over a menu tile to pick it.

## Play it

**https://www.alecsharpie.me/jumpingjack/** (hosted on GitHub Pages)

Everything runs client-side: the pose model runs in your browser via WebAssembly/WebGL, and no video ever leaves your machine. The model is fetched from a CDN on first load.

### Local development

The site is plain static files with no build step. Browsers won't load ES modules from `file://`, so serve the folder with any static server, for example:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## TV setup

1. Plug the laptop into the TV. Either mirror the displays, or drag the browser window onto the TV.
2. Put the laptop at the front centre of the TV, lid open, webcam facing the room.
3. Stand in a bright room. Head-and-shoulders close-ups are fine for most games; step back 2–3 m for full-body ones like Jumping Jacks.
4. Press **PLAY!**. It goes fullscreen, and from then on you don't need the keyboard.

## Games

| Game | How to play | 2 players |
|---|---|---|
| 🥋 Kung Foo | Ninjas fly at your head. Punch or kick them, fast. Red ones are quicker, gold ones are worth more. 5 lives. | Versus |
| 🧽 Wishi Washi | The screen is covered in grime. Wipe it clean with your arms and body, and move around the room. | Co-op |
| ✊ Rock Paper Scissors | Throw ✊ ✋ or ✌️ on "SHOOT!". First to 3. | You vs CPU, or face off |
| 🤸 Jumping Jacks | Do as many as you can in 30 s. Arms up and feet out, then back together. Counts arms only if your feet aren't visible. | Race |
| 🤟 Hand Signs | Copy the hand sign shown (✊ ✋ ✌️ ☝️ 👍 👎 🤟) as fast as you can. | Versus, first to match gets a bonus |
| 🫧 Bubble Pop | Pop rising bubbles with any body part. Gold bubbles are a bonus, bombs cost points. | Versus |
| ⚽ Keepy Uppy | Keep the football in the air. Headers, knees and kicks score double. 3 balls. | A ball each |

### Multiplayer

Up to 2 people can play from the same camera. Just stand side by side: whoever is in view when "GO!" appears is in the game, with P1 on the left. Each player gets their own colour for cursors, skeleton and score. Use `?players=3` (up to 4) if you have the room; more people means slower tracking.

The hand-sign games use MediaPipe's gesture recogniser. It loads in the background after the pose model, and works best with your hand raised towards the camera within about 2 m.

High scores are saved in the browser.

## Keys (optional)

`F` fullscreen · `M` mute · `S` show skeleton · `V` toggle mirror · `C` next camera · `D` debug stats · `Esc` back to menu

The mouse also works as an extra "hand", which is handy for testing without stepping back.

URL options: `?model=lite` loads a faster, less accurate model for slow laptops (`heavy` is also available), `?players=N` sets how many people to track (1–4, default 2), `?mirror=0` turns off mirroring, `?debug` shows FPS and pose timing.

## Code

- `js/main.js`: startup, camera, render loop, keyboard
- `js/vision.js`: MediaPipe pose landmarker and gesture recogniser setup
- `js/body.js`: turns landmarks into smoothed, screen-space body parts with velocities and hit tests; `Crowd` keeps player identities stable across frames
- `js/gestures.js`: gesture names/emoji and hand drawing
- `js/scenes.js`: calibration, menu and results screens
- `js/games/*.js`: one file per game, all built on `games/base.js` (intro, countdown, players, HUD, timer, lives)
- `js/audio.js`: synthesised sound effects and music (no audio files)
- `js/fx.js`: particles, popups, hover buttons, drawing helpers
