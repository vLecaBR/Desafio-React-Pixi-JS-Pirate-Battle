# Credits and licenses

## Game assets

All sprites, spritesheets, tilesheets, UI sprites, reference images, sounds and the
Jungle Gaming logo in [`public/assets/`](public/assets/) were **provided by Jungle
Gaming as part of the developer challenge** ([CHALLENGE.md](CHALLENGE.md)) and are
used under the challenge's terms. No license file was distributed with them.

Derived files (generated from those assets by scripts in this repository and
committed for reproducibility):

| File                                            | Source                                                                      | Script                 |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ---------------------- |
| `public/assets/generated/ships_sheet.json`      | `spritesheet/ships_miscellaneous_sheet.xml` (Starling) → TexturePacker JSON | `npm run assets:atlas` |
| `public/assets/generated/sounds/*.ogg`, `*.m4a` | `sounds/*.wav` (Vorbis q4 / AAC 96 kbps)                                    | `npm run assets:audio` |

The splash ring and the darkened letterbox are drawn in code.

## Fonts

Self-hosted in [`src/ui/fonts/`](src/ui/fonts/) (Latin subsets, taken from the
Fontsource packages), licensed under the **SIL Open Font License 1.1**; the license
texts are included next to the files.

| Font                                                            | Use                    | License                      |
| --------------------------------------------------------------- | ---------------------- | ---------------------------- |
| [Rubik](https://github.com/googlefonts/rubik) (variable weight) | Headings, buttons, HUD | OFL 1.1 — `OFL-Rubik.txt`    |
| [Fira Sans](https://github.com/mozilla/Fira) 400 / 600 / 700    | Body text              | OFL 1.1 — `OFL-FiraSans.txt` |

## Libraries

Runtime:

| Library                                      | Version | License |
| -------------------------------------------- | ------- | ------- |
| [React](https://react.dev) / React DOM       | 19      | MIT     |
| [PixiJS](https://pixijs.com)                 | 8       | MIT     |
| [TanStack Query](https://tanstack.com/query) | 5       | MIT     |
| [Axios](https://axios-http.com)              | 1       | MIT     |
| [MSW](https://mswjs.io)                      | 2       | MIT     |
| [Zustand](https://zustand.docs.pmnd.rs)      | 5       | MIT     |
| [Zod](https://zod.dev)                       | 4       | MIT     |

Development and tooling (not shipped in the build):

| Tool                                                               | License                                                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Vite, @vitejs/plugin-react, Vitest                                 | MIT                                                                                                                               |
| TypeScript                                                         | Apache-2.0                                                                                                                        |
| Playwright (@playwright/test)                                      | Apache-2.0                                                                                                                        |
| ESLint, typescript-eslint, eslint plugins, Prettier                | MIT                                                                                                                               |
| TanStack Query Devtools (development builds only)                  | MIT                                                                                                                               |
| tsx, fast-xml-parser                                               | MIT                                                                                                                               |
| ffmpeg-static (FFmpeg binary, used only by `npm run assets:audio`) | GPL-3.0-or-later; FFmpeg itself is LGPL/GPL. Only its output (the compressed sounds) is committed; the binary is not distributed. |

The Docker image `mcr.microsoft.com/playwright` is used only to generate and compare
visual regression baselines.
