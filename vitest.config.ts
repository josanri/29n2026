/// <reference types="vitest/config" />
// The Astro Vite config: the tests resolve `@/…` and `@eleccion/…` like the site does.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
