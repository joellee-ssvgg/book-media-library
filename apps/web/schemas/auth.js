import { z } from "zod";
export const optionalAccessTokenSchema = z.preprocess((value) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
}, z.string().optional());
