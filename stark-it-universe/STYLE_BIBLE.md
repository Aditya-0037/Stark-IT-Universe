# Stark IT Universe: style bible

One look for the whole journey: **soft-bevel clay low-poly**, told as one continuous early morning before school opens. The numbers below live in code in `src/art/styleBible.ts` and `src/art/palette.json`. New 3D work takes them from there.

## Story rules
- **One morning.** The SIU sun is the only key light in space. The same warm gold key, from the same direction and at the same colour temperature (about 3,600 K), becomes the morning sun on Earth. The classroom is dim because it is dawn; "Switch on the classroom" is sunrise indoors. The page ends by pulling back out to dusk and night.
- **Gold means "SIU is here or acting".** Gold (#FFB52E) is used only for the sun, the orbit route, the satellite, the lit window, the power-up, AMC and the call to action. It is never decoration.
- **Service colours are a code.** SmartClass violet #8B5CF6, IFP cyan #06B6D4, Projector pink #EC4899, Laptop blue #3B82F6, CAT-6 green #10B981. Each classroom device's hotspot ring and accent glow use its planet's colour.
- **One night.** Every night on the page (3D space, Proof, contact, footer) is the same brand night: #060A22 at the top to #0B1640 at the bottom.

## Shape
- **Bevels:** every box has a bevel of about 6 % of its smallest dimension (allowed range 4–8 %), in 3 segments. No raw 90° edges anywhere. Use `softBox()` (a RoundedBox) or a bevelled ExtrudeGeometry until the GLBs arrive.
- **Exaggeration:** hero devices (IFP, projector, rack) are scaled 1.2–1.5× (`SCALE.hero` = 1.3) so they read on a phone; secondary props sit slightly smaller (`SCALE.secondary` = 0.92).

## Materials (only four families)
| Family | Roughness | Metalness | Use |
|---|---|---|---|
| Matte clay (`clay`) | 0.6–0.9 | 0 | walls, ground, furniture, almost everything |
| Painted metal (`paintedMetal`) | 0.3–0.5 | 0.35 | frames, poles, device shells, desks' steel |
| Glass and screens (`glass`) | 0.05–0.2 | 0.1 | windows, panels when off |
| Emissive (`emissive`) | n/a | n/a | only things that emit light: sun, screens, LEDs, lit windows, the satellite's nav light, tube lights |

Baked textures from Blender already carry the view transform: use `baked()` (`toneMapped: false`) so nothing is tone-mapped twice.

## Colour
- Every surface uses three values (light, base, shadow), baked into vertex colours (`gi()`: lighter at the top of a part, darker at its foot) or sampled from the palette texture.
- Every colour comes from one palette (`palette.json`, rendered as the 64 × 64 `paletteTexture()` and `docs/palette.png`). Re-palette every imported asset to it.

## Light
- **Key:** one warm light, #FFD49A. It is the only light that casts shadows. On Earth it stands 25–35° high (30° by default) on one clear side, so all shadows are long and point the same way.
- **Fill:** a cool hemisphere in the universe-blue family (sky #93ACFF, ground #0B1640).
- **Rim (optional):** #6F86FF, to separate silhouettes.
- Light intensities are animated; lights are never switched on or off (that changes the shader light count and recompiles mid-scroll).

## Tone mapping and glow
- Tone mapping is Khronos PBR Neutral (`THREE.NeutralToneMapping`). ACES desaturates bright yellow, green and cyan, which are exactly the sun gold and CAT-6 green.
- Glow is selective: bloom with `luminanceThreshold` 1 and intensity 0.6 or less (mipmap blur). Only an emissive or basic colour above 1.0 glows. Nothing else blooms.

## Value and composition
- Each scene follows its row in the colour script (`docs/colour-script.png`).
- In every hold, either the 3D or the text panel is the focal point; the other recedes.
- No surface clips to pure white over more than 2 % of the frame.
