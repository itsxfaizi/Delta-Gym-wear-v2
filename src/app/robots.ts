import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/structured-data";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/cart", "/checkout", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
