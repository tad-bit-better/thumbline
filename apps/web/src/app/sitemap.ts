import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

/** The public pages; the app's steps are left out (they are marked noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: 'weekly', priority: 1 }];
}
