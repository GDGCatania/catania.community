// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

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
    plugins: [
      // Compiles messages/{locale}.json into tree-shakeable functions.
      // `strategy: ['baseLocale']` means: always use the language set as
      // `baseLocale` in project.inlang/settings.json. One language per build,
      // resolved at compile time, nothing about i18n reaching the browser.
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['baseLocale'],
        emitTsDeclarations: true,
      }),
    ],
    build: {
      // The islands are few and small: one less chunk to download.
      assetsInlineLimit: 2048,
    },
  },
});
