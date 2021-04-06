import axios, { AxiosInstance } from "axios";
import ytsr from "ytsr";
import ytdl, { videoFormat } from "ytdl-core";
import { parseDate } from "chrono-node";
import got from "got";
import fs from "fs";
import tmp from "tmp";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { ignore } from "stream-json/filters/Ignore";
import { streamValues } from "stream-json/streamers/StreamValues";

export interface SearchItem {
  id: number;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channel: string;
}

export interface MediaInfo {
  song?: string;
  artist?: string;
  album?: string;
}

export interface VideoItem {
  videoId: string;
  title: string;
  category: string;
  uploadDate: string;
  videoLength: string;
  mediaInfo: MediaInfo;
  formats: {
    highest: videoFormat;
    lowest: videoFormat;
    highestVideo: videoFormat;
    lowestVideo: videoFormat;
    highestAudio: videoFormat;
    lowestAudio: videoFormat;
  };
  formatsRaw: Array<videoFormat>;
}

const ytApiRequest: AxiosInstance = axios.create({
  baseURL: "https://www.googleapis.com/youtube/v3/",
});

export const searchOfficial = async (
  searchQuery: string
): Promise<SearchItem[]> => {
  if (!searchQuery) throw new Error("no search query");
  let results = await ytApiRequest.get("search", {
    params: {
      q: searchQuery,
      part: "snippet",
      maxResults: 50,
      type: "video",
      key: process.env.YOUTUBE_API_KEY || null,
    },
  });

  if (!results.data?.items) throw new Error("results couldn't fetch");

  return results.data.items.map((item: any) => {
    return {
      id: item.id.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail: `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
      channel: item.snippet.channelTitle,
    };
  });
};

export const searchUnofficial = async (
  searchQuery: string
): Promise<SearchItem[]> => {
  if (!searchQuery) throw new Error("no search query");

  let filters = await ytsr.getFilters(searchQuery);
  let filter = filters.get("Type")?.get("Video");
  let results;
  if (filter?.url) {
    results = await ytsr(filter.url, { limit: 50 });
  } else {
    results = await ytsr(searchQuery, { limit: 50 });
  }

  return results.items.map((item: any) => {
    return {
      id: item.id,
      title: item.title,
      publishedAt: String(parseDate(item.uploadedAt)),
      thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      channel: item.author.name,
    };
  });
};

export const getInfoUnofficial = async (id: string): Promise<VideoItem> => {
  let videoInfo = await ytdl.getInfo("https://youtube.com/watch?v=" + id);
  return {
    videoId: videoInfo.videoDetails.videoId,
    title: videoInfo.videoDetails.title,
    category: videoInfo.videoDetails.category,
    uploadDate: videoInfo.videoDetails.uploadDate,
    videoLength: videoInfo.videoDetails.lengthSeconds,
    // @ts-ignore Property 'album' is missing in type 'Media'
    mediaInfo: videoInfo.videoDetails.media,
    formats: {
      highest: ytdl.chooseFormat(videoInfo.formats, { quality: "highest" }),
      lowest: ytdl.chooseFormat(videoInfo.formats, { quality: "lowest" }),
      highestVideo: ytdl.chooseFormat(videoInfo.formats, {
        quality: "highestvideo",
      }),
      lowestVideo: ytdl.chooseFormat(videoInfo.formats, {
        quality: "lowestvideo",
      }),
      highestAudio: ytdl.chooseFormat(videoInfo.formats, {
        quality: "highestaudio",
      }),
      lowestAudio: ytdl.chooseFormat(videoInfo.formats, {
        quality: "lowestaudio",
      }),
    },
    formatsRaw: videoInfo.formats,
  };
};

export const getMusicLists = async (countryCode: string) => {
  const webPageRaw = await got(
    `https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ?persist_gl=1&gl=${countryCode.toUpperCase()}&persist_hl=1&hl=${countryCode}`
  );

  const regex = /var ytInitialData = (.*);<\/script>/gm;
  const results = regex.exec(webPageRaw.body);

  if (!results?.length) throw new Error();
  if (results.length >= 2 === false) throw new Error();

  const data: any = await parseBigJson(results[1]);

  return data.map((shelf: any) => {
    let firstItem = shelf?.content?.horizontalListRenderer?.items[0];

    if (firstItem?.compactStationRenderer) {
      return {
        title: shelf.title.runs[0].text,
        type: "Playlists",
        items: shelf.content.horizontalListRenderer.items.map((item: any) => {
          let i = item.compactStationRenderer;
          return {
            id: i.navigationEndpoint.watchEndpoint.playlistId,
            title: i.title.simpleText,
            description: i.description.simpleText,
            videoCount: i.videoCountText.runs[0].text,
            thumbnail: i.thumbnail.thumbnails.reduce(
              (prev: number, curr: number) => (prev > curr ? prev : curr)
            ).url,
          };
        }),
      };
    } else if (firstItem?.gridVideoRenderer) {
      return {
        title: shelf.title.runs[0].text,
        type: "Videos",
        playlistId:
          shelf.title.runs[0].navigationEndpoint.browseEndpoint.browseId,
        items: shelf.content.horizontalListRenderer.items.map((item: any) => {
          let i = item.gridVideoRenderer;
          return {
            id: i.videoId,
            title: i.title?.simpleText,
            thumbnail: `https://i.ytimg.com/vi/${i.videoId}/hqdefault.jpg`,
            publishedAt: i.publishedTimeText?.simpleText,
            viewsCount: i.shortViewCountText?.simpleText,
            duration:
              i.thumbnailOverlays[0].thumbnailOverlayTimeStatusRenderer.text
                ?.simpleText,
          };
        }),
      };
    } else if (firstItem?.gridPlaylistRenderer) {
      return {
        title: shelf.title.runs[0].text,
        type: "Playlists",
        items: shelf.content.horizontalListRenderer.items.map((item: any) => {
          const i = item.gridPlaylistRenderer;
          return {
            id: i.playlistId,
            title: i.title.runs[0].text,
            thumbnail: `https://i.ytimg.com/vi/${i.navigationEndpoint.watchEndpoint.videoId}/hqdefault.jpg`,
            videoCount: i.videoCountText.runs[0].text,
          };
        }),
      };
    } else {
      return null;
    }
  });
};

const parseBigJson = (rawJson: string) => {
  return new Promise((resolve, reject) => {
    const tempFile = tmp.fileSync({ postfix: ".json" }).name;
    fs.writeFileSync(tempFile, rawJson);

    const foundData: any = [];

    const pipeline = chain([
      fs.createReadStream(tempFile),
      parser(),
      pick({ filter: /shelfRenderer/i }),
      ignore({ filter: /tracking/i }),
      streamValues(),
      (data: any) => {
        foundData.push(data.value);
        return data;
      },
    ]);

    pipeline.output.on("end", () => resolve(foundData));
    pipeline.output.on("error", (err: any) => reject(err));
  });
};
