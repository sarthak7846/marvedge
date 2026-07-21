"use strict";

// Bundled asset paths for the Cloud Run worker.
//
// The Dockerfile copies this repo into /app (WORKDIR), so cloudrun-worker/assets
// lands at /app/assets inside the image. PR 2's render.js resolves the default
// watermark from here when a recipe has no custom `assetUrl`.
//
// The default watermark is Logo.png bundled AS-IS — the solid blue Marvedge
// badge (black mark on its periwinkle tile), rendered small in the corner. This
// is intentional: the blue tile is the recognizable brand badge, not a bug to
// key out. If design later provides a transparent mark-only PNG, swap the file
// in and lower the render opacity — no code change needed here.
const MARVEDGE_WATERMARK_PATH = "/app/assets/marvedge-watermark.png";

module.exports = { MARVEDGE_WATERMARK_PATH };
