import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/public-pages/data";
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = "image/png";
function shortText(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
export default async function PublicProfileOgImage({ params }) {
    const { username } = await params;
    const data = await getPublicProfile(username);
    if (data.status !== "active") {
        const title = data.status === "gone" ? "已注销用户" : "公开主页不可用";
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
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700 }}>{title}</div>
          <div style={{ color: "#6c675f", display: "flex", fontSize: 30, marginTop: 28 }}>
            @{username}
          </div>
        </div>), size);
    }
    const name = data.profile.display_name ?? data.profile.username;
    const topTitles = data.top3.slice(0, 3).map((entry) => entry.title);
    return new ImageResponse((<div style={{
            background: "#f7f5ef",
            color: "#1f2423",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui",
            height: "100%",
            justifyContent: "space-between",
            padding: 64,
            width: "100%",
        }}>
        <div style={{ alignItems: "center", display: "flex" }}>
          <div style={{
            alignItems: "center",
            background: "#e9e2d4",
            border: "2px solid #d8d2c4",
            borderRadius: 56,
            color: "#315f53",
            display: "flex",
            fontSize: 42,
            fontWeight: 700,
            height: 112,
            justifyContent: "center",
            overflow: "hidden",
            width: 112,
        }}>
            {data.profile.avatar_url ? (<img alt="" height="112" src={data.profile.avatar_url} width="112"/>) : (name.slice(0, 1).toUpperCase())}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
            <div style={{ color: "#6c675f", display: "flex", fontSize: 30 }}>
              @{data.profile.username}
            </div>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 800, marginTop: 8 }}>
              {shortText(name, 18)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#315f53", display: "flex", fontSize: 30, marginBottom: 18 }}>
            精选 Top-3
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {(topTitles.length ? topTitles : ["暂无公开精选"]).map((title, index) => (<div key={`${title}-${index}`} style={{
                background: "#fffdf8",
                border: "2px solid #d8d2c4",
                display: "flex",
                flexDirection: "column",
                height: 138,
                justifyContent: "center",
                padding: "22px 24px",
                width: 330,
            }}>
                <div style={{ color: "#6c675f", display: "flex", fontSize: 24 }}>#{index + 1}</div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 700, marginTop: 10 }}>
                  {shortText(title, 18)}
                </div>
              </div>))}
          </div>
        </div>

        <div style={{ color: "#5f665f", display: "flex", fontSize: 28 }}>
          <span>{data.stats.public_entries} 个公开条目</span>
          <span style={{ marginLeft: 32 }}>{data.stats.completed} 个完成</span>
          <span style={{ marginLeft: 32 }}>{data.stats.reviewed} 条短评</span>
        </div>
      </div>), size);
}
