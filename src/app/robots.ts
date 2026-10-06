import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /_next/ не закрываем: без скриптов, стилей и оптимизатора картинок
    // поисковик не отрисует страницу и не проиндексирует фотографии.
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
    // Главное зеркало для Яндекса.
    host: site.url,
  };
}
