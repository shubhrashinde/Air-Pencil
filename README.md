# AirArt 🎨

A modern, premium‑looking web‑based drawing app powered by **MediaPipe Hands** for air‑gesture drawing.  
The app supports:

- ✍️ **Air drawing** with smooth brush strokes via hand tracking.
- 🧽 **Eraser** (pinky finger toggle).
- 🎨 **Dynamic colour palette** and custom colour picker.
- 🎚️ **Brush size** and multiple brush types (solid, neon glow, spray, calligraphy).
- 📁 **Reference image overlay** for tracing.
- 💾 **Save** artwork as PNG.
- 📱 **Responsive UI** with a landing page and a full‑screen drawing canvas.
- 🎯 **Zoom & pan** that correctly maps coordinates (fixed transform‑origin bug).
- 👤 **Contributor cards** with personal photos.
- 🔗 **Clickable logo** that returns to the landing page.

## Live demo
[https://your‑deployment‑url.com](#) *(replace with your actual URL when deployed)*

## Getting started

```bash
# Clone the repo
git clone https://github.com/daystar-1nine/air-art.git
cd air-art

# Install dependencies (Vite + TypeScript)
npm install

# Run locally
npm run dev
```

Open `http://localhost:5173` in Chrome (the app works best in Chrome due to MediaPipe).  
Allow camera permissions when prompted.

## Project structure
```
src/
 ├─ core/                # Core logic – HandTracker, CanvasRenderer, UIManager, ColorBends
 ├─ styles/              # CSS for landing, app, and canvas layout
 ├─ landing.ts           # Background animation for landing page
 ├─ main.ts              # App entry point – camera init, UI wiring
 └─ index.html / app.html # Landing and drawing pages
public/
 ├─ suraj.jpg            # Suraj's profile picture
 └─ shubhra.jpg          # Shubhra's profile picture
```

## Key technical notes
- **Canvas resize safety** – guards against a `0×0` size that caused a `DOMException`.
- **Transform‑origin** set to `0 0` so CSS scaling matches the drawing math.
- **DOM ready handling** – robust `DOMContentLoaded` checks to avoid race conditions.
- **Unused variables** removed to keep the TypeScript build clean.

## Contributing
Feel free to open issues or submit PRs.  
All contributions should follow the existing code style and include appropriate tests where possible.

## License
MIT © 2026 AirArt contributors
