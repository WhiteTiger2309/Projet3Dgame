import { defineConfig } from 'vite'

export default defineConfig({
    base: '/Projet3Dgame/',
    server: {
        fs: {
            // Allow serving files outside of the root
            allow: ['../..']
        }
    },
    optimizeDeps: { exclude: ['@babylonjs/havok'] },
})