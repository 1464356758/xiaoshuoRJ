import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Resolve locked tools through declared root dependencies, not pnpm internals.
export const esbuild=await import(createRequire(require.resolve('wrangler/package.json')).resolve('esbuild'));
export const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
export const tailwind=(await import('@tailwindcss/postcss')).default;
