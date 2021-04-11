import { Request, Response } from "express";
import { cache } from "../index";
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
  let cachedResults: any =
    process.env.NODE_ENV !== "production"
      ? null
      : cache.get(`search_${searchQuery}`);
  if (cachedResults) {
    results = cachedResults;
  } else {
    try {
      results = await searchUnofficial(searchQuery);
    } catch {
      results = await searchOfficial(searchQuery);
    }
    cache.set(`search_${searchQuery}`, results);
  }

  res.json(results);
};

export default search;
