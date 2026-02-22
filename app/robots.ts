import type { MetadataRoute } from "next"
import { getPublicSiteUrl } from "@/lib/site-url"

const siteUrl = getPublicSiteUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/"],
        disallow: [
          "/api/",
          "/admin",
          "/auth/",
          "/bots",
          "/channels",
          "/dashboard",
          "/discover",
          "/messages",
          "/profile",
          "/settings",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
