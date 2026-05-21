export type MediaTypeId = "book" | "movie" | "tv" | "music" | "game" | "comic";

export type EnabledMediaTypeId = Extract<MediaTypeId, "book" | "movie">;

export type StatusGroup = "to_do" | "in_progress" | "complete" | "abandoned";

export type StatusOption = {
  key: string;
  labelKey: string;
  isTerminal: boolean;
  isActive: boolean;
  group: StatusGroup;
};

export type ProgressModelId =
  | "book_page_progress"
  | "watch_log"
  | "tv_linear_progress"
  | "audiobook_minute_progress"
  | "comic_chapter_progress"
  | "podcast_episode_progress"
  | "game_hour_progress";

export type ProviderId =
  | "openlibrary"
  | "googlebooks"
  | "tmdb"
  | "manual"
  | "douban"
  | "letterboxd"
  | "trakt";

export type SearchTextConfig = "chinese_jieba" | "english" | "simple";

export type AnnotationLocationKind = "book" | "video";

export type RatingScale = {
  minX10: 5;
  maxX10: 50;
  stepX10: 5;
};

export interface MediaTypeRegistry {
  id: EnabledMediaTypeId;
  labelKey: string;
  iconEmoji: string;
  statusOptions: StatusOption[];
  defaultStatus: string;
  ratingScale: RatingScale | null;
  defaultProgressModel: ProgressModelId;
  supportedEditionTypes: string[];
  editionTypeToProgressModel: Record<string, ProgressModelId>;
  searchProviders: ProviderId[];
  manualEntryAllowed: true;
  annotationLocationKind: AnnotationLocationKind;
  pickSearchConfig: (text: string) => SearchTextConfig;
  publicSummaryFields: string[];
}
