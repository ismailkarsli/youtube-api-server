import { Request, Response } from "express";
import fs from "fs";
import { getInfoUnofficial, VideoItem } from "../controllers/youtube";
import ffmpegPath from "ffmpeg-static";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";
import { cache } from "../index";
import parseTitle from "../utils/parseTitle";

const download = async (req: Request, res: Response) => {
  const videoId = String(req.query.id);
  if (!videoId || videoId.length !== 11) {
    res.status(400);
    return res.send("error: invalid id");
  }

  let videoInfo: VideoItem;
  let cachedVideoInfo: any = cache.get(`video_${videoId}`);
  if (cachedVideoInfo) {
    videoInfo = cachedVideoInfo;
  } else {
    try {
      videoInfo = await getInfoUnofficial(videoId);
      cache.set(`video_${videoId}`, videoInfo);
    } catch (e) {
      res.status(500);
      return res.send(e.toString());
    }
  }

  const highestAudio = videoInfo.formats.highestAudio;
  const parsedTitle = parseTitle(videoInfo.title);

  const title = videoInfo.mediaInfo.song || parsedTitle?.title;
  const artist = videoInfo.mediaInfo.artist || parsedTitle?.artist;

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
      `title=${title || ""}`,
      "-metadata",
      `artist=${artist || ""}`,
      "-metadata",
      `description=YouTube ID: ${videoId}`,
      "pipe:1",
    ]);
    const fileWriter = fs.createWriteStream(file);
    ffmpegProc.stdout.pipe(fileWriter);

    ffmpegProc.on("close", async (code: number) => {
      if (code !== 0) {
        res.status(500);
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

const generateResponse = (fileSize?: number, range?: string) => {
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
      headers: {
        "Content-Type": "audio/mpeg",
      },
    };
  }
};

export default download;
