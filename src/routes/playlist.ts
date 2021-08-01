import { Request, Response } from "express";
import { cache } from "../index";
import { getPlaylistUnofficial } from "../controllers/youtube";

const playlist = async (req: Request, res: Response) => {
  const playlistId = String(req.query.id);
  if (!playlistId || playlistId.length < 30 || playlistId.length > 50) {
    res.status(400);
    return res.send("error: invalid id or invalid");
  }

  let results;
  let cachedResults =
    process.env.NODE_ENV !== "production"
      ? null
      : cache.get(`playlist_${playlistId}`);
  if (cachedResults) {
    results = cachedResults;
  } else {
    try {
      results = await getPlaylistUnofficial(playlistId);
    } catch (e) {
      res.status(500);
      return res.send("error: request to youtube failed");
    }
    cache.set(`playlist_${playlistId}`, results);
  }

  res.json(results);
};

export default playlist;
