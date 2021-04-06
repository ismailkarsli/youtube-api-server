import { Request, Response } from "express";
import { getMusicLists } from "../controllers/youtube";

const search = async (req: Request, res: Response) => {
  const countryCode = String(req.query.countryCode);
  if (!countryCode || countryCode.length !== 2) {
    res.status(400);
    return res.send("error: no countryCode specified");
  }

  const musicLists = await getMusicLists(countryCode);

  res.json(musicLists);
};

export default search;
