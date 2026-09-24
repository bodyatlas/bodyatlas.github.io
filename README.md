# Layered Body Atlas

Interactive 3D human anatomy you can peel from skin to bone: every body system, both eyes and ears in detail, cross-sections and part-by-part notes.

**Live:** https://bodyatlas.github.io/

- Peel the body layer by layer with the depth slider: skin, fat, superficial and deep muscles, vessels, nerves, lymphatics, organs, glands, skeleton.
- Toggle body systems, ghost peeled layers, cut cross-sections on any axis, and switch between the male and female body.
- Hover or click any of the 1,285 parts for its name, Latin name, function, size and a clinical note.

Every structure is generated procedurally with [Three.js](https://threejs.org) (r160, loaded from cdnjs) from a shared anatomical landmark set in `core/landmarks.js`; each body system is one module in `systems/`. It is a static site with no build step: serve the folder and open `index.html`.

The models are simplified illustrations for learning, not medical-grade scans.

---

This repository also hosts **[Clausery](https://bodyatlas.github.io/clausery/)**, an unrelated project: browser-only document automation for law firms, HR and consultancies. It lives entirely in the [`clausery/`](clausery/) folder and has its own README, tests and CI.
