# VK motion logo — sources

1. `npm i` (three@0.160.0)
2. `python3 -m http.server 8765` in this folder
3. Render frames: `node render.js 0 720 1` → `frames/f0000.jpg…`
4. Audio: `python3 audio.py` → `music.wav`
5. Encode: `ffmpeg -framerate 60 -i frames/f%04d.jpg -i music.wav -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k vk_logo.mp4`

`window.renderFrame(i)` renders frame i deterministically (t = i/60) with subframe motion blur.
