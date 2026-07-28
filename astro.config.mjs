// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://catania.community',
  output: 'static',
  trailingSlash: 'never',

  // No locale segment in the URLs: there is one set of pages, served in Italian,
  // and the interface strings are swapped to English in the browser when the
  // visitor's language is not Italian. See src/i18n/runtime.ts.
  integrations: [sitemap()],
  build: {
    // Un file per rotta invece di /rotta/index.html: URL più pulite su Pages.
    format: 'file',
  },
  vite: {
    build: {
      // Le island sono piccole e poche: un chunk in meno da scaricare.
      assetsInlineLimit: 2048,
    },
  },
});
