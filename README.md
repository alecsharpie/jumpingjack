# Jumping Jack

An EyeToy-style party game that runs entirely in the browser. The laptop's webcam watches you, MediaPipe pose tracking finds your head, hands, knees and feet, and you play by moving. There are no buttons: hold a hand over a menu tile to pick it.

## Run it

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge. The browser only allows camera access on `localhost` or HTTPS, so open it that way rather than as a `file://` path.

The pose model is loaded from a CDN the first time, so you need a network connection for the first load.

## TV setup

1. Plug the laptop into the TV. Either mirror the displays, or drag the browser window onto the TV.
2. Put the laptop at the front centre of the TV, lid open, webcam facing the room.
3. Stand 2–3 m back in a bright room. The calibration screen tells you when it can see you from head to toe.
4. Press **PLAY!**. It goes fullscreen, and from then on you don't need the keyboard.

## Games

| Game | How to play |
|---|---|
| 🥋 Kung Foo | Ninjas fly at your head. Punch or kick them, fast. Red ones are quicker, gold ones are worth more. 5 lives. |
| 🧽 Wishi Washi | The screen is covered in grime. Wipe it clean with your arms and body, and move around the room. |
| 🤸 Jumping Jacks | Do as many as you can in 30 s. Arms up and feet out, then back together. Counts arms only if your feet aren't visible. |
| 🫧 Bubble Pop | Pop rising bubbles with any body part. Gold bubbles are a bonus, bombs cost points. |
| ⚽ Keepy Uppy | Keep the football in the air. Headers, knees and kicks score double. 3 balls. |

High scores are saved in the browser.

## Keys (optional)

`F` fullscreen · `M` mute · `S` show skeleton · `V` toggle mirror · `C` next camera · `D` debug stats · `Esc` back to menu

The mouse also works as an extra "hand", which is handy for testing without stepping back.

URL options: `?model=lite` loads a faster, less accurate model for slow laptops (`heavy` is also available), `?mirror=0` turns off mirroring, `?debug` shows FPS and pose timing.

## Code

- `js/main.js`: startup, camera, render loop, keyboard
- `js/pose.js`: MediaPipe PoseLandmarker setup
- `js/body.js`: turns landmarks into smoothed, screen-space body parts with velocities and hit tests
- `js/scenes.js`: calibration, menu and results screens
- `js/games/*.js`: one file per game, all built on `games/base.js` (intro, countdown, HUD, timer, lives)
- `js/audio.js`: synthesised sound effects and music (no audio files)
- `js/fx.js`: particles, popups, hover buttons, drawing helpers
