# Chess Knight 006 hero model

`chess-knight-006-web.glb` is an optimized derivative of **Chess Knight 006** by **Vijay Saini**, published on [Sketchfab](https://skfb.ly/pEJVJ) under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).

Changes made: the mesh was welded, simplified from 1,172,948 triangles / 623,246 position vertices to 175,942 triangles / 92,653 position vertices, quantized, and compressed with Meshopt. The original base-color texture was removed because this hero applies its own near-black material and lighting. The optimized GLB is 735,428 bytes, 97.8% smaller than the 34,190,264-byte original. The derivative uses `EXT_meshopt_compression` and `KHR_mesh_quantization`; the local Three.js loader and Meshopt decoder are included with their licenses. The original GLB is retained privately and is not shipped.

Optimized GLB SHA-256: `76bd343db745a8a75290016e639ff1993a6ee912889baf6b4beb1b51f9726a9d`.

Public attribution appears beside the hero and links to the source and license: “Chess Knight 006” by Vijay Saini, CC BY 4.0; optimized and recolored for the portfolio. The model remains a current placeholder pending the owner's final artistic review.

`chess-knight-006-poster-desktop.webp` and `chess-knight-006-poster-mobile.webp` are responsive static captures of the opening scene rendered from the optimized derivative. They preserve the resting left-facing pose, fixed studio lights, low-poly wire overlay, and floor reflection, and keep the Home visually complete before WebGL is ready or when WebGL is unavailable. Both posters are derivative imagery under the same CC BY 4.0 attribution above.

At runtime, Three.js `SimplifyModifier` creates a separate low-poly geometry overlay (about 1,100 target vertices) from the optimized model. The original optimized mesh remains the dark, lit sculpture; only the reduced overlay supplies the visible construction lines. This keeps the facets coherent instead of drawing every edge from the dense source mesh. The floor reflection keeps the lit sculpture and omits the overlay so its reflection remains clean.

`chess-knight-006-preview.png` remains a simpler emergency image fallback if a poster asset itself fails to load.
