# Layered Body Atlas

Interactive 3D human anatomy you can peel from skin to bone: every body system, both eyes and ears in detail, cross-sections and part-by-part notes.

**Live:** https://bodyatlas.github.io/

- Peel the body layer by layer with the depth slider: skin, fat, superficial and deep muscles, vessels, nerves, lymphatics, organs, glands, skeleton.
- Toggle body systems, ghost peeled layers, cut cross-sections on any axis, and switch between the male and female body.
- Hover or click any of the 1,285 parts for its name, Latin name, function, size and a clinical note.

Every structure is generated procedurally with [Three.js](https://threejs.org) (r160, loaded from cdnjs) from a shared anatomical landmark set in `core/landmarks.js`; each body system is one module in `systems/`. It is a static site with no build step: serve the folder and open `index.html`.

The models are simplified illustrations for learning, not medical-grade scans.

---

[Clausery](https://getclausery.github.io/), an unrelated project, has moved to its own repository, [getclausery/getclausery.github.io](https://github.com/getclausery/getclausery.github.io). The [`clausery/`](clausery/) folder here only redirects its old page addresses to the new site and keeps a frozen copy of the app for anyone whose drafts are stored in their browser at this address.
