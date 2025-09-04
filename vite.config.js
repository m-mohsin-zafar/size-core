import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'SizeCore',
      fileName: (format) => `size-core.${format}.js`
    },
    rollupOptions: {
      // Externalize nothing for now; script is self-contained
    }
  }
});
