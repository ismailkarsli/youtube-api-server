import { Request, Response } from "express";
import { getPlaylistUnofficial } from "../controllers/youtube";

const home = async (req: Request, res: Response) => {
  const playlistId = String(req.query.id);
  if (!playlistId || playlistId.length < 30 || playlistId.length > 50) {
    res.status(400);
    return res.send("error: invalid id or invalid");
  }

  let results;
  try {
    results = await getPlaylistUnofficial(playlistId);
  } catch (e) {
    res.status(500);
    return res.send("error: request to youtube failed");
  }

  res.send(results);
};

export default home;
