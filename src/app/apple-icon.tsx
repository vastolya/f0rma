import { ImageResponse } from "next/og";

/** Иконка для «На экран Домой» на iPhone — тот же ледяной ромб, что в icon.svg. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#04070c",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 64 64">
          <path d="M32 7 57 32 32 57 7 32Z" fill="none" stroke="#9fe3ff" strokeWidth="3.5" />
          <path d="M32 7v50M7 32h50" stroke="#6cd0f5" strokeWidth="2" opacity="0.7" />
        </svg>
      </div>
    ),
    size,
  );
}
