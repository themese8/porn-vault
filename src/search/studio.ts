import { getClient, indexMap } from "./index";
import Studio from "../types/studio";
import * as logger from "../utils/logger";
import { addSearchDocs, buildIndex, indexItems, ProgressCallback } from "./internal/buildIndex";

export interface IStudioSearchDoc {
  id: string;
  addedOn: number;
  name: string;
  labels: string[];
  labelNames: string[];
  bookmark: number | null;
  favorite: boolean;
  // rating: number;
  numScenes: number;
}

export async function createStudioSearchDoc(studio: Studio): Promise<IStudioSearchDoc> {
  const labels = await Studio.getLabels(studio);
  // const actors = await Studio.getActors(studio);

  return {
    id: studio._id,
    addedOn: studio.addedOn,
    name: studio.name,
    labels: labels.map((l) => l._id),
    labelNames: labels.map((l) => [l.name, ...l.aliases]).flat(),
    // rating: studio.rating,
    bookmark: studio.bookmark,
    favorite: studio.favorite,
    numScenes: (await Studio.getScenes(studio)).length,
  };
}

async function addStudioSearchDocs(docs: IStudioSearchDoc[]) {
  return addSearchDocs(indexMap.studios, docs);
}

export async function updateStudios(studios: Studio[]): Promise<void> {
  // return index.update(await mapAsync(studios, createStudioSearchDoc));
  // TODO:
}

export async function indexStudios(
  studios: Studio[],
  progressCb?: ProgressCallback
): Promise<number> {
  return indexItems(studios, createStudioSearchDoc, addStudioSearchDocs, progressCb);
}

export async function buildStudioIndex(): Promise<void> {
  await buildIndex(indexMap.studios, Studio.getAll, indexStudios);
}

export interface IStudioSearchQuery {
  query: string;
  favorite?: boolean;
  bookmark?: boolean;
  // rating: number;
  include?: string[];
  exclude?: string[];
  sortBy?: string;
  sortDir?: string;
  skip?: number;
  take?: number;
  page?: number;
}

const PAGE_SIZE = 24;

interface ISearchResults {
  items: string[];
  total: number;
  numPages: number;
}

export async function searchStudios(
  options: Partial<IStudioSearchQuery>,
  shuffleSeed = "default"
): Promise<ISearchResults> {
  logger.log(`Searching studios for '${options.query || "<no query>"}'...`);

  const labelFilter = () => {
    if (options.include && options.include.length) {
      return [
        {
          query_string: {
            query: `(${options.include.map((name) => `labels:${name}`).join(" AND ")})`,
          },
        },
      ];
    }
    return [];
  };

  const query = () => {
    if (options.query && options.query.length) {
      return [
        {
          multi_match: {
            query: options.query || "",
            fields: ["name^2", "labelNames"],
            fuzziness: "AUTO",
          },
        },
      ];
    }
    return [];
  };

  const favorite = () => {
    if (options.favorite) {
      return [
        {
          term: { favorite: true },
        },
      ];
    }
    return [];
  };

  const bookmark = () => {
    if (options.bookmark) {
      return [
        {
          exists: {
            field: "bookmark",
          },
        },
      ];
    }
    return [];
  };

  const isShuffle = options.sortBy === "$shuffle";

  const sort = () => {
    if (isShuffle) {
      return {};
    }
    if (options.sortBy === "relevance" && !options.query) {
      return {
        sort: { addedOn: "desc" },
      };
    }
    if (options.sortBy && options.sortBy !== "relevance") {
      return {
        sort: {
          [options.sortBy]: options.sortDir || "desc",
        },
      };
    }
    return {};
  };

  const shuffle = () => {
    if (isShuffle) {
      return {
        function_score: {
          query: { match_all: {} },
          random_score: {
            seed: shuffleSeed,
          },
        },
      };
    }
    return {};
  };

  const result = await getClient().search<IStudioSearchDoc>({
    index: indexMap.studios,
    from: Math.max(0, +(options.page || 0) * PAGE_SIZE),
    size: PAGE_SIZE,
    body: {
      ...sort(),
      track_total_hits: true,
      query: {
        bool: {
          must: isShuffle ? shuffle() : query().filter(Boolean),
          filter: [
            ...labelFilter(), // TODO: exclude labels
            ...bookmark(),
            ...favorite(),
          ],
        },
      },
    },
  });
  // @ts-ignore
  const total = result.hits.total.value;

  return {
    items: result.hits.hits.map((doc) => doc._source.id),
    total,
    numPages: Math.ceil(total / PAGE_SIZE),
  };
}
