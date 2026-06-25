import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/react.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  tsconfig: "tsconfig.build.json",
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react']
});
