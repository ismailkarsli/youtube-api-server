import axios, { AxiosInstance } from "axios";
import ytsr from "ytsr";
import ytdl, { videoFormat } from "ytdl-core";
import { parseDate } from "chrono-node";

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
      key: process.env.YOUTUBE_API_KEY,
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
