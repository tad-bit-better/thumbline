import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

/**
 * Everything may be crawled. The app's steps (listen, sheet) carry `noindex` instead of a
 * Disallow: a crawler must be able to fetch a page to see that it shouldn't be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
