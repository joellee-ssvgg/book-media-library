import { bookRegistry } from "./book";
import { movieRegistry } from "./movie";
import type { EnabledMediaTypeId, MediaTypeId, MediaTypeRegistry } from "./types";

const registries: Record<MediaTypeId, MediaTypeRegistry | undefined> = {
  book: bookRegistry,
  movie: movieRegistry,
  tv: undefined,
  music: undefined,
  game: undefined,
  comic: undefined,
};

export function getRegistry(id: MediaTypeId): MediaTypeRegistry {
  const registry = registries[id];

  if (!registry) {
    throw new Error(`Registry for media type "${id}" is not enabled in this phase.`);
  }

  return registry;
}

export function listEnabledMediaTypes(): EnabledMediaTypeId[] {
  return (Object.keys(registries) as MediaTypeId[]).filter(isEnabledMediaTypeId);
}

export function listEnabledRegistries(): MediaTypeRegistry[] {
  return listEnabledMediaTypes().map(getRegistry);
}

export function isEnabledMediaTypeId(value: unknown): value is EnabledMediaTypeId {
  return value === "book" || value === "movie";
}

export type {
  AnnotationLocationKind,
  EnabledMediaTypeId,
  MediaTypeId,
  MediaTypeRegistry,
  ProgressModelId,
  ProviderId,
  RatingScale,
  SearchTextConfig,
  StatusGroup,
  StatusOption,
} from "./types";
