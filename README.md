# Layered Body Atlas

Interactive 3D human anatomy you can peel from skin to bone: every body system, both eyes and ears in detail, cross-sections and part-by-part notes.

**Live:** https://bodyatlas.github.io/

- Peel the body layer by layer with the depth slider: skin, fat, superficial and deep muscles, vessels, nerves, lymphatics, organs, glands, skeleton.
- Toggle body systems, ghost peeled layers, cut cross-sections on any axis, and switch between the male and female body.
- Hover or click any of the 1,285 parts for its name, Latin name, function, size and a clinical note.
- Realistic rendering (the **Realistic** button, or `Q`): studio image-based lighting, soft shadows, screen-space ambient occlusion and per-tissue surface detail. Switch to Fast on slower machines; phones start in Fast.

Every structure is generated procedurally with [Three.js](https://threejs.org) (r160, loaded from cdnjs) from a shared anatomical landmark set in `core/landmarks.js`; each body system is one module in `systems/`. It is a static site with no build step: serve the folder and open `index.html`.

## Rendering

- `core/helpers.js` gives every part a physically based material from a tissue preset (skin, fat, fascia, muscle, heart, bone, tooth, cartilage, vessel, nerve, brain, organ, liver, gut, lung, gland, lymph, mucosa, membrane, hair, nail, sclera, iris, cornea...). The preset is chosen from the module's colour, the part's name and its system, so modules keep passing plain colours.
- A small shader patch adds procedural, texture-free surface detail in world space: pores and mottling on skin, fibre striations on muscles, tendons, nerves and vessels, lobules on fat and glands, porous bone, hair strands, roughness variation, and a wrap-lighting subsurface term that lets red bleed into the shadow side of skin and organs. Detail fades out by itself once it is smaller than a pixel.
- `core/studio.js` lights the body with a procedural softbox studio (a PMREM environment map), a shadow-casting key light on a shadow-catching floor, and a post-processing chain built from core Three.js only: MSAA half-float colour pass, half-resolution normal+depth pre-pass that respects the cut plane, SSAO, depth-aware blur, then a composite with the page backdrop, tone mapping and sRGB output. If float render targets are unavailable it falls back to Fast automatically.

The models are simplified illustrations for learning, not medical-grade scans.
