type ParsedTitle = {
  title: string;
  artist: string;
};

export default (rawTitle: string): ParsedTitle | null => {
  let title = removeUnnecessaryParts(rawTitle);
  if (blacklistTitle(title)) {
    return null;
  }

  let extractedFeats = extractFeaturings(title);

  let titleWithoutFeats = extractedFeats.title.trim();
  let featurings = extractedFeats.featurings;

  let artistTitleSplitted = splitArtistTitle(titleWithoutFeats);
  if (!artistTitleSplitted) {
    return null;
  }

  let artistWithFeats = [artistTitleSplitted.artist.trim(), ...featurings].join(
    ", "
  );

  return { title: artistTitleSplitted.title.trim(), artist: artistWithFeats };
};

const splitArtistTitle = (title: string): ParsedTitle | null => {
  const splitted = title.split(" - ");
  if (
    splitted.length === 2 &&
    splitted[0].match(/[\d\w]/) &&
    splitted[1].match(/[\d\w]/)
  ) {
    return { artist: splitted[0], title: splitted[1] };
  } else {
    return null;
  }
};

const removeUnnecessaryParts = (title: string): string => {
  const replaced = title
    .replace(
      /((\(|\[)[^\(\[]*?(official|video|version|electro|edm|lyrics|hd|hq|original|trap|monstercat|clip|klip).*?(\)|\]))/gim,
      ""
    )
    .trim();

  return replaced;
};

const blacklistTitle = (title: string): boolean => {
  const result = title.match(
    /(reaction|playlist|full album|1 hour| 24 hour|24\/7|7\/24|pop hits|live at)/i
  );
  if (result && result.length > 0) {
    return true;
  } else {
    return false;
  }
};

const extractFeaturings = (
  title: string
): { title: string; featurings: string[] } => {
  const featurings: string[] = [];

  let titleMutatable = title;
  let found;
  while (true) {
    found = titleMutatable.match(
      / (ft\.?|featuring|feat\.?|&|vs\.?| x|,)(.+?)(?: &| -| –| ,|$)/gim
    );

    if (!found) {
      break;
    }
    found.map((item: any) => {
      const artist = item
        .replace(
          / (ft\.?|featuring|feat\.?|&|vs\.?| x|,)(.+?)(?: &| -| –| ,|$)/gim,
          "$2"
        )
        .trim();

      let partToRemove = item.replace(
        / ((?:ft\.?|featuring|feat\.?|&|vs\.?| x|,)(?:.+?))(?: &| -| –| ,|$)/gim,
        "$1"
      );
      if (partToRemove.endsWith(" ")) {
        partToRemove = partToRemove.slice(0, -1);
      }
      titleMutatable = titleMutatable.replace(partToRemove, "");

      featurings.push(artist);
    });
  }

  return { title: titleMutatable, featurings };
};
