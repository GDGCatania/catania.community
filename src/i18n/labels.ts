import * as m from '../paraglide/messages.js';
import type { Area, Category, Price } from '../lib/schema';

export const categoryLabel: Record<Category, () => string> = {
  tech: m.category_tech,
  design: m.category_design,
  impresa: m.category_impresa,
  cultura: m.category_cultura,
  sociale: m.category_sociale,
};

export const areaLabel: Record<Area, () => string> = {
  citta: m.area_citta,
  provincia: m.area_provincia,
  online: m.area_online,
};

export const priceLabel: Record<Price['type'], () => string> = {
  free: m.price_free,
  donation: m.price_donation,
  paid: m.price_paid,
};