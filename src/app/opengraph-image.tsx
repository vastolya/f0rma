import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

/*
  Превью ссылки в мессенджерах и соцсетях. Собирается при сборке: фото работы
  справа, заголовок сайта слева — тем же шрифтом, что и на страницах.
*/

export const alt = "Ледовая скульптура с подсветкой ночью — коллектив «Форма», Красноярск";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const root = process.cwd();
  const [cyrillic, latin, photo] = await Promise.all([
    readFile(join(root, "src/assets/fonts/oswald-cyrillic-500.woff")),
    readFile(join(root, "src/assets/fonts/oswald-latin-500.woff")),
    readFile(join(root, "public/media/divnogorsk-elka-2025/01.jpg")),
  ]);

  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#04070c",
          fontFamily: "Oswald",
          color: "#f2f8fc",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 720,
            padding: "64px 56px 56px 72px",
            backgroundImage:
              "radial-gradient(circle at 0% 0%, rgba(185,166,255,0.18), rgba(4,7,12,0) 60%)",
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: 4, color: "#6cd0f5" }}>
            ЛЕДОВЫЕ СКУЛЬПТУРЫ · КРАСНОЯРСК
          </div>

          <div style={{ display: "flex", flexDirection: "column", fontSize: 62, lineHeight: 1.04, whiteSpace: "nowrap" }}>
            <span>ЛЁД ДЕРЖИТ ФОРМУ</span>
            <span style={{ paddingLeft: 56 }}>РОВНО ОДНУ ЗИМУ</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 24,
              color: "#8ba8bd",
              borderTop: "1px solid rgba(139,168,189,0.3)",
              paddingTop: 20,
            }}
          >
            <span>КОЛЛЕКТИВ «{site.name.toUpperCase()}»</span>
            <span>{site.contacts.phone.label}</span>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- внутри ImageResponse next/image не работает */}
        <img
          src={photoSrc}
          alt=""
          width={480}
          height={630}
          style={{ objectFit: "cover", objectPosition: "50% 70%" }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Oswald", data: cyrillic, weight: 500, style: "normal" },
        { name: "Oswald", data: latin, weight: 500, style: "normal" },
      ],
    },
  );
}
