import { pickSearchConfigByCJKRatio } from "./search-config";
import type { MediaTypeRegistry } from "./types";

export const movieRegistry: MediaTypeRegistry = {
  id: "movie",
  labelKey: "media.movie.label",
  iconEmoji: "🎬",
  statusOptions: [
    {
      key: "want_to_watch",
      labelKey: "media.movie.status.want_to_watch",
      isTerminal: false,
      isActive: false,
      group: "to_do",
    },
    {
      key: "watching",
      labelKey: "media.movie.status.watching",
      isTerminal: false,
      isActive: true,
      group: "in_progress",
    },
    {
      key: "watched",
      labelKey: "media.movie.status.watched",
      isTerminal: true,
      isActive: false,
      group: "complete",
    },
    {
      key: "abandoned",
      labelKey: "media.movie.status.abandoned",
      isTerminal: true,
      isActive: false,
      group: "abandoned",
    },
  ],
  defaultStatus: "want_to_watch",
  ratingScale: { minX10: 5, maxX10: 50, stepX10: 5 },
  defaultProgressModel: "watch_log",
  supportedEditionTypes: ["theatrical", "tv_cut", "director_cut"],
  editionTypeToProgressModel: {
    theatrical: "watch_log",
    tv_cut: "watch_log",
    director_cut: "watch_log",
  },
  searchProviders: ["tmdb", "manual"],
  manualEntryAllowed: true,
  annotationLocationKind: "video",
  pickSearchConfig: pickSearchConfigByCJKRatio,
  publicSummaryFields: ["canonical_title", "first_release_year", "cover_url"],
};
