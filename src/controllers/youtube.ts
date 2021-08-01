import axios, { AxiosInstance } from "axios";
import ytsr from "ytsr";
import ytpl from "ytpl";
import ytdl, { videoFormat } from "ytdl-core";
import { parseDate } from "chrono-node";
import pickDeepJson from "../utils/pickDeepJson";
import parseTitle from "../utils/parseTitle";

export interface SearchItem {
  id: number;
  title: string;
  artist: string;
  publishedAt: string | null;
  thumbnail: string;
}

export interface MediaInfo {
  song?: string;
  artist?: string;
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

export interface PlaylistItem {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  thumbnail: string | null;
  songs: PlaylistItem[] | any;
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

  const items = results.data.items.map((item: any): SearchItem | null => {
    const parsedTitle = parseTitle(item.snippet.title);
    if (!parsedTitle) {
      return null;
    }
    return {
      id: item.id.videoId,
      title: parsedTitle.title,
      artist: parsedTitle.artist,
      publishedAt: item.snippet.publishedAt,
      thumbnail: `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
    };
  });

  return items.filter((i: any) => i);
};

export const searchUnofficial = async (searchQuery: string): Promise<any[]> => {
  if (!searchQuery) throw new Error("no search query");

  let filters = await ytsr.getFilters(searchQuery);
  let filter = filters.get("Type")?.get("Video");
  let results;
  if (filter?.url) {
    results = await ytsr(filter.url, { limit: 50 });
  } else {
    results = await ytsr(searchQuery, { limit: 50 });
  }

  const items = results.items.map((item: any): SearchItem | null => {
    const parsedTitle = parseTitle(item.title);
    if (!parsedTitle) {
      return null;
    }
    return {
      id: item.id,
      title: parsedTitle.title,
      artist: parsedTitle.artist,
      publishedAt: item.uploadedAt ? String(parseDate(item.uploadedAt)) : null,
      thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    };
  });

  return items.filter((i: any) => i);
};

export const getInfoUnofficial = async (id: string): Promise<VideoItem> => {
  let videoInfo = await ytdl.getInfo("https://youtube.com/watch?v=" + id);
  return {
    videoId: videoInfo.videoDetails.videoId,
    title: videoInfo.videoDetails.title,
    category: videoInfo.videoDetails.category,
    uploadDate: videoInfo.videoDetails.uploadDate,
    videoLength: videoInfo.videoDetails.lengthSeconds,
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

// TODO rewrite
export const getMusicListsUnofficial = async (countryCode: string) => {
  const webPageRaw = await axios(
    `https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ?persist_gl=1&gl=${countryCode.toUpperCase()}&persist_hl=1&hl=${countryCode}`
  );

  const regex = /var ytInitialData = (.*);<\/script>/gm;
  const results = regex.exec(webPageRaw.data);

  if (!results?.length) throw new Error();
  if (results.length >= 2 === false) throw new Error();

  const data: any = await pickDeepJson(results[1], /shelfRenderer/);

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
            thumbnail: i.thumbnail.thumbnails.reduce((prev: any, curr: any) =>
              prev.width > curr.width ? prev : curr
            ).url,
          };
        }),
      };
    } else if (firstItem?.gridVideoRenderer) {
      const items = shelf.content.horizontalListRenderer.items.map(
        (item: any) => {
          let i = item.gridVideoRenderer;
          const parsedTitle = parseTitle(i.title?.simpleText);
          if (!parsedTitle) {
            return null;
          }
          return {
            id: i.videoId,
            title: parsedTitle?.title,
            artist: parsedTitle?.artist,
            thumbnail: `https://i.ytimg.com/vi/${i.videoId}/hqdefault.jpg`,
          };
        }
      );

      return {
        title: shelf.title.runs[0].text,
        type: "Songs",
        playlistId:
          shelf.title.runs[0].navigationEndpoint.browseEndpoint.browseId,
        items: items.filter((i: any) => i),
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
          };
        }),
      };
    } else {
      return null;
    }
  });
};

export const getPlaylistUnofficial = async (id: string): Promise<Playlist> => {
  const plist = await ytpl(id);

  const items = plist.items.map((item): PlaylistItem | null => {
    const parsedTitle = parseTitle(item.title);
    if (!parsedTitle) {
      return null;
    }
    return {
      id: item.id,
      title: parsedTitle.title,
      artist: parsedTitle.artist,
      artwork: item.bestThumbnail.url,
    };
  });

  const filteredItems = items.filter((i: any) => i);

  return {
    id: plist.id,
    name: plist.title,
    thumbnail: plist.bestThumbnail?.url,
    songs: filteredItems,
  };
};
