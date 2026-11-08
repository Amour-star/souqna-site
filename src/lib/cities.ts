import {SYRIA_CITIES} from '@/data/syria-cities';

/** URL slugs for city landing pages (`/city/damascus`) — the same rule the server uses. */
const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const CITY_PAGES = SYRIA_CITIES.map(city => ({...city, slug: toSlug(city.en)}));

export const cityBySlug = (slug: string) => CITY_PAGES.find(city => city.slug === slug.toLowerCase());
