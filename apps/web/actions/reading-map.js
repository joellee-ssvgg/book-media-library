"use server";
import { loadReadingMapFormSchema } from "@/schemas/reading-map";
import { getReadingMapData } from "@/lib/reading-map/data";
import { addBookCountry, removeBookCountry } from "@/lib/reading-map/country-manager";

function toFieldErrors(result) {
  return result.success ? undefined : result.error.flatten().fieldErrors;
}

export async function loadReadingMapAction(previousState, formData) {
  const parsed = loadReadingMapFormSchema.safeParse({
    accessToken: formData.get("accessToken"),
  });
  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "加载阅读地图需要先登录。",
      fieldErrors: toFieldErrors(parsed),
      data: previousState.data,
    };
  }

  const result = await getReadingMapData(parsed.data.accessToken);
  if (result.error) {
    return {
      status: "error",
      message: result.error,
      data: previousState.data,
    };
  }

  return {
    status: "loaded",
    message: null,
    data: result.data,
  };
}

export async function addBookCountryAction(formData) {
  const accessToken = formData.get("accessToken");
  const entryId = formData.get("entryId");
  const countryCode = formData.get("countryCode");
  const countryName = formData.get("countryName");

  return addBookCountry(accessToken, entryId, countryCode, countryName);
}

export async function removeBookCountryAction(formData) {
  const accessToken = formData.get("accessToken");
  const entryId = formData.get("entryId");
  const countryCode = formData.get("countryCode");

  return removeBookCountry(accessToken, entryId, countryCode);
}
