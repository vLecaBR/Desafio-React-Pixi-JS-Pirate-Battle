#!/usr/bin/env node
/**
 * Converts the Starling XML ship atlas into the TexturePacker JSON (hash) format
 * that PixiJS `Assets.load` understands natively.
 *
 * Input:  public/assets/spritesheet/ships_miscellaneous_sheet(.xml|_retina.xml)
 * Output: public/assets/generated/ships_sheet.json
 *
 * Note: the "retina" ship atlas shipped with the challenge has the same image size
 * (1024x512) and the same frame sizes as the default one (only a few frames are packed
 * at different positions), i.e. it is NOT a 2x atlas. The script derives the scale from
 * the image sizes and only emits `ships_sheet_retina.json` when it is actually higher
 * resolution; otherwise a single 1x atlas is used for every device pixel ratio.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheetDir = path.join(root, 'public/assets/spritesheet');
const outDir = path.join(root, 'public/assets/generated');

const SOURCES = {
  default: { xml: 'ships_miscellaneous_sheet.xml', out: 'ships_sheet.json' },
  retina: { xml: 'ships_miscellaneous_sheet_retina.xml', out: 'ships_sheet_retina.json' },
};

/** Reads width/height from a PNG IHDR chunk. */
async function readPngSize(file) {
  const buffer = await readFile(file);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${file} is not a PNG file`);
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

async function readAtlas(xmlName) {
  const xml = await readFile(path.join(sheetDir, xmlName), 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const atlas = parser.parse(xml).TextureAtlas;
  if (!atlas?.imagePath || !atlas.SubTexture) throw new Error(`${xmlName}: unexpected format`);
  const subTextures = Array.isArray(atlas.SubTexture) ? atlas.SubTexture : [atlas.SubTexture];
  const image = await readPngSize(path.join(sheetDir, atlas.imagePath));
  return { imagePath: atlas.imagePath, image, subTextures };
}

function toTexturePacker(atlas, scale) {
  const frames = {};
  const named = atlas.subTextures.map((sub) => ({ ...sub, name: sub.name.replace(/\.png$/, '') }));
  named.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  for (const sub of named) {
    const name = sub.name;
    const x = Number(sub.x);
    const y = Number(sub.y);
    const w = Number(sub.width);
    const h = Number(sub.height);
    // Starling optional trim data: frameX/frameY are negative offsets into the source size.
    const frameX = sub.frameX === undefined ? 0 : -Number(sub.frameX);
    const frameY = sub.frameY === undefined ? 0 : -Number(sub.frameY);
    const sourceW = sub.frameWidth === undefined ? w : Number(sub.frameWidth);
    const sourceH = sub.frameHeight === undefined ? h : Number(sub.frameHeight);
    const trimmed = sourceW !== w || sourceH !== h;
    frames[name] = {
      frame: { x, y, w, h },
      rotated: sub.rotated === 'true',
      trimmed,
      spriteSourceSize: { x: frameX, y: frameY, w, h },
      sourceSize: { w: sourceW, h: sourceH },
      anchor: { x: 0.5, y: 0.5 },
    };
  }
  return {
    frames,
    meta: {
      app: 'scripts/convert-ship-atlas.mjs',
      version: '1.0',
      image: `../spritesheet/${atlas.imagePath}`,
      format: 'RGBA8888',
      size: atlas.image,
      scale: String(scale),
    },
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const base = await readAtlas(SOURCES.default.xml);
  const retina = await readAtlas(SOURCES.retina.xml);

  const outputs = [[SOURCES.default.out, toTexturePacker(base, 1)]];

  const retinaScale = retina.image.w / base.image.w;
  if (retinaScale <= 1) {
    console.log(
      'Retina ship atlas is not higher resolution (scale 1): emitting a single 1x atlas.',
    );
  } else {
    outputs.push([SOURCES.retina.out, toTexturePacker(retina, retinaScale)]);
  }

  for (const [file, json] of outputs) {
    await writeFile(path.join(outDir, file), `${JSON.stringify(json, null, 2)}\n`);
    console.log(
      `Wrote ${path.relative(root, path.join(outDir, file))} (${Object.keys(json.frames).length} frames, scale ${json.meta.scale})`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
