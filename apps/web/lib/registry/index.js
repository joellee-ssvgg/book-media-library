import { bookRegistry } from "./book";
import { movieRegistry } from "./movie";
const registries = {
    book: bookRegistry,
    movie: movieRegistry,
    tv: undefined,
    music: undefined,
    game: undefined,
    comic: undefined,
};
export function getRegistry(id) {
    const registry = registries[id];
    if (!registry) {
        throw new Error(`Registry for media type "${id}" is not enabled in this phase.`);
    }
    return registry;
}
export function listEnabledMediaTypes() {
    return Object.keys(registries).filter(isEnabledMediaTypeId);
}
export function listEnabledRegistries() {
    return listEnabledMediaTypes().map(getRegistry);
}
export function isEnabledMediaTypeId(value) {
    return value === "book" || value === "movie";
}
