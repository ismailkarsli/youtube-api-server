import express from "express";
import home from "./routes/home";
import search from "./routes/search";
import trends from "./routes/trends";
import download from "./routes/download";
import NodeCache from "node-cache";

export const cache = new NodeCache({ stdTTL: 3 * 86400, useClones: false });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.disable("x-powered-by");

app.get("/", home);
app.get("/trends", trends);
app.get("/search", search);
app.get("/download", download);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Listening at http://localhost:${PORT}`);
});
