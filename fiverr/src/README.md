# Fiverr gig video — sources

- `src/extract.py` — extracts logo mattes (4x), components and clean (inpainted) backgrounds from the mockups.
- `python3 -m http.server 8767` in `src/`, then `node render.js 0,2280,1` → frames
- `python3 audio.py` → music.wav
- encode with ffmpeg (H.264, yuv420p, AAC), capped bitrate to stay under the 50 MB Fiverr limit.
