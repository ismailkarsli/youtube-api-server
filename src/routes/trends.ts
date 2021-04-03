import { Request, Response } from "express";

const search = (req: Request, res: Response) => {
  res.json({ name: "Muzik app API server", "api-version": 1 });
};

export default search;
