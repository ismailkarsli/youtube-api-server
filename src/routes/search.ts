import { Request, Response } from "express";
import {
  SearchItem,
  searchOfficial,
  searchUnofficial,
} from "../controllers/youtube";

const search = async (req: Request, res: Response) => {
  if (!req.query.query) {
    res.status(400);
    return res.send("error: no search query");
  }
  const searchQuery = String(req.query.query).trim().toLowerCase();

  let results: SearchItem[];
  try {
    results = await searchUnofficial(searchQuery);
  } catch {
    results = await searchOfficial(searchQuery);
  }

  res.json(results);
};

export default search;
