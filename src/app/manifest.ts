import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Коллектив «${site.name}» — ледовые скульптуры`,
    short_name: site.name,
    description: site.description,
    lang: "ru",
    start_url: "/",
    display: "standalone",
    background_color: "#04070c",
    theme_color: "#04070c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
