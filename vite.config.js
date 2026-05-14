import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // Use Vue's full build (with runtime template compiler) so inline
            // `template: '...'` strings in our small helper components — like
            // CommentRow and InfoRow defined inside BuilderPanel.vue — actually
            // compile at runtime. Without this, the default runtime-only build
            // silently warns and renders nothing for those templates. Adds
            // ~30 kB gzipped; fine for an internal tool.
            vue: 'vue/dist/vue.esm-bundler.js',
        },
    },
    server: {
        open: true,
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
            },
        },
    },
});
