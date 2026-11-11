import {SYRIA_CITIES, type CanonicalCity} from '../../src/data/syria-cities.js';

export interface SeoCity extends CanonicalCity {
  slug: string;
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** ASCII URL slugs (`/city/damascus`) built from the shared English city names. */
export const CITIES: SeoCity[] = SYRIA_CITIES.map(city => ({...city, slug: toSlug(city.en)}));

const bySlug = new Map(CITIES.map(city => [city.slug, city]));
const byId = new Map(CITIES.map(city => [city.id, city]));

export const cityBySlug = (slug: string): SeoCity | undefined => bySlug.get(slug.toLowerCase());
export const cityById = (id: number | null | undefined): SeoCity | undefined =>
  id === null || id === undefined ? undefined : byId.get(Number(id));

export const cityPath = (city: Pick<SeoCity, 'slug'>, categoryId?: string): string =>
  categoryId ? `/city/${city.slug}/${categoryId}` : `/city/${city.slug}`;
