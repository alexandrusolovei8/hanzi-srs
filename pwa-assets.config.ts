import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate icons with `npm run generate-pwa-assets` after editing public/icon.svg.
// Generated PNG/ICO files are committed so builds don't depend on image tooling.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
});
