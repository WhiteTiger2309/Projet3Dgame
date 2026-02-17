export default {
    server: {
            fs: {
            // Allow serving files outside of the root
            allow: ["../.."]
            }
        },
    optimizeDeps: { exclude: ["@babylonjs/havok"] },
}