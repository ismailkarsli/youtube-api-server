import { Request, Response } from "express";
import { cache } from "../index";
import { getMusicListsUnofficial } from "../controllers/youtube";

const trends = async (req: Request, res: Response) => {
  const countryCode = String(req.query.countryCode).toLowerCase();
  if (!countryCode || countryCode.length !== 2) {
    res.status(400);
    return res.send("error: no countryCode specified or invalid");
  }

  let musicLists;
  let cachedMusicLists =
    process.env.NODE_ENV === "production"
      ? cache.get(`trends_${countryCode}`)
      : false;
  if (cachedMusicLists) {
    musicLists = cachedMusicLists;
  } else {
    try {
      musicLists = await getMusicListsUnofficial(countryCode);
    } catch (e) {
      res.status(500);
      return res.send(e.toString());
    }
    cache.set(`trends_${countryCode}`, musicLists);
  }

  res.json(musicLists);
};

export default trends;
