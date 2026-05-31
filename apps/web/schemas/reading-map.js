import { z } from "zod";
import { optionalAccessTokenSchema } from "@/schemas/auth";

export const loadReadingMapFormSchema = z.object({
  accessToken: optionalAccessTokenSchema,
});

export const initialReadingMapData = {
  country_counts: {},
  entries: [],
};

export const initialReadingMapActionState = {
  status: "idle",
  data: initialReadingMapData,
};
