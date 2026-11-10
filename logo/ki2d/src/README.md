# Ki 2D motion logo — sources

- `node render.js 0,480` → frames/f0000.png… (pure Canvas 2D, ~1 min)
- `python3 audio.py` → music.wav
- `ffmpeg -framerate 60 -i frames/f%04d.png -i music.wav -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k ki_logo_2d.mp4`
