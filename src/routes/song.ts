import { Request, Response } from "express";
import { cache } from "../index";
import { getInfoUnofficial } from "../controllers/youtube";
import parseTitle from "../utils/parseTitle";

const playlist = async (req: Request, res: Response) => {
  const songId = String(req.query.id);
  if (!songId || songId.length !== 11) {
    res.status(400);
    return res.send("error: invalid id");
  }

  let results;
  let cachedResults =
    process.env.NODE_ENV !== "production" ? null : cache.get(`song_${songId}`);

  if (cachedResults) {
    results = cachedResults;
  } else {
    try {
      results = await getInfoUnofficial(songId);

      if (results.mediaInfo?.song && results.mediaInfo?.artist) {
        results = {
          id: results.videoId,
          title: results.mediaInfo.song,
          artist: results.mediaInfo.artist,
          thumbnail: `https://i.ytimg.com/vi/${results.videoId}/hqdefault.jpg`,
          publishedAt: results.uploadDate,
          videoLength: results.videoLength,
        };
      } else {
        const parsedTitle = parseTitle(results.title);
        if (parsedTitle) {
          results = {
            id: results.videoId,
            title: parsedTitle.title,
            artist: parsedTitle.artist,
            thumbnail: `https://i.ytimg.com/vi/${results.videoId}/hqdefault.jpg`,
            publishedAt: results.uploadDate,
            videoLength: results.videoLength,
          };
        } else {
          results = {
            id: results.videoId,
            title: results.title,
            artist: "",
            thumbnail: `https://i.ytimg.com/vi/${results.videoId}/hqdefault.jpg`,
            publishedAt: results.uploadDate,
            videoLength: results.videoLength,
          };
        }
      }
    } catch (e) {
      res.status(500);
      return res.send("error: request to youtube failed");
    }
    cache.set(`song_${songId}`, results);
  }

  res.json(results);
};

export default playlist;
