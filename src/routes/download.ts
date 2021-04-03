import { Request, Response } from "express";
import fs from "fs";
import { getInfoUnofficial } from "../controllers/youtube";
const ffmpegPath = require("ffmpeg-static");
const { tmpdir } = require("os");
const { join } = require("path");
const { spawn } = require("child_process");

const download = async (req: Request, res: Response) => {
  const videoId = String(req.query.id);
  if (!videoId || videoId.length !== 11) {
    res.status(400);
    return res.send("error: invalid id");
  }

  let videoInfo;
  try {
    videoInfo = await getInfoUnofficial(videoId);
  } catch (e) {
    res.status(500);
    return res.send(e.toString());
  }

  const highestAudio = videoInfo.formats.highestAudio;

  let bitrate = "320000";
  if (highestAudio.audioBitrate) {
    if (highestAudio.audioBitrate < 1000) {
      bitrate = highestAudio.audioBitrate + "000";
    } else {
      bitrate = String(highestAudio.audioBitrate);
    }
  }

  const file = join(tmpdir(), videoId + ".mp3");
  if (fs.existsSync(file)) {
    const fileStats = fs.statSync(file);
    const r = generateResponse(fileStats.size, req.get("Range"));
    res.writeHead(r.statusCode, r.headers);
    const fileReader = fs.createReadStream(file, r.readOptions);
    fileReader.pipe(res);
  } else {
    let ffmpegProc = spawn(ffmpegPath, [
      "-i",
      highestAudio.url,
      "-vn",
      "-b:a",
      bitrate,
      "-f",
      "mp3",
      "-metadata",
      `title=${videoInfo.mediaInfo.song || ""}`,
      "-metadata",
      `artist=${videoInfo.mediaInfo.artist || ""}`,
      "-metadata",
      `album=${videoInfo.mediaInfo.album || ""}`,
      "-metadata",
      `description=YouTube ID: ${videoId}`,
      "pipe:1",
    ]);
    const fileWriter = fs.createWriteStream(file);
    ffmpegProc.stdout.pipe(fileWriter);
    ffmpegProc.on("exit", async (code: number) => {
      if (code !== 0) {
        res.status(500);
        console.log(code);
        return res.send("internal error");
      }
      const fileStats = fs.statSync(file);
      const r = generateResponse(fileStats.size, req.get("Range"));
      res.writeHead(r.statusCode, r.headers);
      const fileReader = fs.createReadStream(file, r.readOptions);
      fileReader.pipe(res);
    });
  }
};

const generateResponse = (
  fileSize: number | undefined,
  range: string | undefined
) => {
  if (fileSize) {
    if (range) {
      const ranges = range.replace(/bytes=/, "").split("-");

      if (ranges.length < 2) {
        throw new Error("bad range");
      }

      const start = parseInt(ranges[0]);
      const end = ranges[1] ? parseInt(ranges[1]) : fileSize - 1;
      const chunkSize = end - start + 1;

      return {
        statusCode: 206,
        readOptions: { start, end },
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "audio/mpeg",
        },
      };
    } else {
      return {
        statusCode: 200,
        headers: {
          "Content-Length": fileSize,
          "Accept-Ranges": "bytes",
          "Content-Type": "audio/mpeg",
        },
      };
    }
  } else {
    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
    };
  }
};

export default download;
