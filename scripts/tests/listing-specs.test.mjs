import { test } from "node:test";
import assert from "node:assert/strict";
import { specBullets, formatItems, dedupeEquipment } from "../../libs/listingSpecs.js";

const CAMERA = "Check exposure and set your white balance depending on intensity of light (sun or clouds). Video: 4K, 30fps (MP4 or MOV formats) Image: 4000px x 3000px, 12MP (JPG format) (Unless otherwise specified in special instructions)";

test("camera boilerplate becomes short bullets", () => {
  assert.deepEqual(specBullets(CAMERA), [
    "Video: 4K, 30fps, MP4 or MOV",
    "Image: 4000×3000, 12MP, JPG",
    "Note: Check exposure and set your white balance depending on intensity of light (sun or clouds)",
    "Unless special instructions say otherwise",
  ]);
});

test("plain long text splits into sentences", () => {
  assert.deepEqual(specBullets("Fly the full perimeter of the lot. Capture the street view from both directions."), [
    "Fly the full perimeter of the lot",
    "Capture the street view from both directions",
  ]);
});

test("short items are chips, long items are blocks, duplicates dropped", () => {
  const { chips, blocks } = formatItems(["DJI Mavic 3", { name: "Part 107" }, CAMERA, "dji mavic 3", ""]);
  assert.deepEqual(chips, ["DJI Mavic 3", "Part 107"]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0][0], "Video: 4K, 30fps, MP4 or MOV");
});

test("equipment repeated in deliverables is shown once", () => {
  assert.deepEqual(dedupeEquipment(["DJI Mavic 3", CAMERA], [CAMERA]), ["DJI Mavic 3"]);
  assert.deepEqual(dedupeEquipment([CAMERA + " "], [CAMERA]), []);
  assert.deepEqual(dedupeEquipment(["Part 107"], undefined), ["Part 107"]);
});
