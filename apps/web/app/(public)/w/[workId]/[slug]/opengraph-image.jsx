import { ImageResponse } from "next/og";
import { getPublicWork } from "@/lib/public-pages/data";
import { isUuid } from "@/lib/public-pages/slug";
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = "image/png";
function shortText(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
function mediaLabel(mediaType) {
    return mediaType === "book" ? "书籍" : "电影";
}
export default async function PublicWorkOgImage({ params }) {
    const { workId, slug } = await params;
    const data = isUuid(workId) ? await getPublicWork(workId, slug) : { status: "not_found" };
    if (data.status !== "active") {
        return new ImageResponse((<div style={{
                alignItems: "center",
                background: "#f7f5ef",
                color: "#1f2423",
                display: "flex",
                flexDirection: "column",
                fontFamily: "system-ui",
                height: "100%",
                justifyContent: "center",
                width: "100%",
            }}>
          <div style={{ color: "#315f53", display: "flex", fontSize: 34, marginBottom: 28 }}>
            阅迹
          </div>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700 }}>作品不可用</div>
        </div>), size);
    }
    const averageRating = data.stats.average_rating_x10
        ? `${(data.stats.average_rating_x10 / 10).toFixed(1)}`
        : "—";
    return new ImageResponse((<div style={{
            background: "#f7f5ef",
            color: "#1f2423",
            display: "flex",
            fontFamily: "system-ui",
            height: "100%",
            padding: 64,
            width: "100%",
        }}>
        <div style={{
            alignItems: "center",
            background: "#efe8d8",
            border: "2px solid #d8d2c4",
            display: "flex",
            height: 500,
            justifyContent: "center",
            overflow: "hidden",
            width: 330,
        }}>
          {data.edition?.cover_url ? (<img alt="" height="500" src={data.edition.cover_url} width="330"/>) : (<div style={{ color: "#315f53", display: "flex", fontSize: 44, fontWeight: 700 }}>
              阅迹
            </div>)}
        </div>

        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            marginLeft: 52,
            width: 690,
        }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#315f53", display: "flex", fontSize: 32 }}>
              {mediaLabel(data.work.media_type)}
            </div>
            <div style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.08,
            marginTop: 18,
        }}>
              {shortText(data.work.title, 26)}
            </div>
            {data.work.original_title ? (<div style={{ color: "#5f665f", display: "flex", fontSize: 30, marginTop: 20 }}>
                {shortText(data.work.original_title, 34)}
              </div>) : null}
          </div>

          <div style={{ display: "flex" }}>
            <div style={{
            background: "#fffdf8",
            border: "2px solid #d8d2c4",
            display: "flex",
            flexDirection: "column",
            padding: "22px 26px",
            width: 200,
        }}>
              <div style={{ color: "#6c675f", display: "flex", fontSize: 24 }}>公开条目</div>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginTop: 8 }}>
                {data.stats.public_entries}
              </div>
            </div>
            <div style={{
            background: "#fffdf8",
            border: "2px solid #d8d2c4",
            display: "flex",
            flexDirection: "column",
            marginLeft: 18,
            padding: "22px 26px",
            width: 200,
        }}>
              <div style={{ color: "#6c675f", display: "flex", fontSize: 24 }}>短评</div>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginTop: 8 }}>
                {data.stats.reviewed}
              </div>
            </div>
            <div style={{
            background: "#fffdf8",
            border: "2px solid #d8d2c4",
            display: "flex",
            flexDirection: "column",
            marginLeft: 18,
            padding: "22px 26px",
            width: 200,
        }}>
              <div style={{ color: "#6c675f", display: "flex", fontSize: 24 }}>均分</div>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginTop: 8 }}>
                {averageRating}
              </div>
            </div>
          </div>
        </div>
      </div>), size);
}
