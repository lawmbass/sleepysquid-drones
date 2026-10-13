import { requireAdmin } from "@/libs/adminRequest";
import { staticMapImage } from "@/libs/places";

function coordinate(value, min, max) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < min || amount > max) return null;
  return amount;
}

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET"]);
  if (!session) return;

  const lat = coordinate(req.query.lat, -90, 90);
  const lng = coordinate(req.query.lng, -180, 180);
  if (lat == null || lng == null) {
    return res.status(400).json({
      error: "Invalid map",
      message: "That pin could not be shown.",
    });
  }

  const image = await staticMapImage(lat, lng);
  if (!image.ok) {
    console.error("Static map failed", image.reason);
    return res.status(404).end();
  }

  res.setHeader("Content-Type", image.type);
  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.status(200).send(image.bytes);
}
