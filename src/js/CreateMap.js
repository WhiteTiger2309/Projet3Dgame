import * as BABYLON from '@babylonjs/core'

import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

export class CreateMap {
    constructor(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main) {
        this.main = main
        this.player = main.player
        this.player.respawnPos = PLAYER_SPAWN_POS
        this.player.respawnRotation = PLAYER_SPAWN_ROTATION
        this.deltaTime = main.deltaTime

        this.scene = main.scene;

        this.createLights(this.scene)
        this.changeSceneBackground(this.scene)
        this.player.resetPos()
        this.setupFog();

        // Medium bloom for neon accents (post-process on the player camera).
        this.setupNeonBloom();
    }

    setupFog() {
        const scene = this.scene;
        if (!scene) return;

        // Inspired by the Babylon.js fog example:
        // use EXP fog with a small animated density to make the environment feel alive.
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP;

        // Fog color: prefer ambientColor (usually closer to the perceived haze),
        // because clearColor can be near-black in space scenes and makes fog imperceptible.
        const ac = scene.ambientColor;
        const useAmbient = !!ac && (ac.r + ac.g + ac.b) > 0.05;
        const src = useAmbient ? ac : scene.clearColor;
        const r = typeof src?.r === "number" ? src.r : 0.12;
        const g = typeof src?.g === "number" ? src.g : 0.14;
        const b = typeof src?.b === "number" ? src.b : 0.18;
        scene.fogColor = new BABYLON.Color3(r, g, b);

        // Base density tuned for the current scale (ground width ~180).
        // Increase for thicker fog, decrease for subtler depth cue.
        const baseDensity = 0.016;
        const amplitude = 0.006;
        const speed = 0.6; // cycles/sec-ish (driven by deltaTime)

        scene.fogDensity = baseDensity;

        if (this._fogObserver) {
            scene.onBeforeRenderObservable.remove(this._fogObserver);
            this._fogObserver = null;
        }

        let alpha = 0;
        this._fogObserver = scene.onBeforeRenderObservable.add(() => {
            const dt = scene.getEngine().getDeltaTime() / 1000;
            alpha += dt * speed;
            const d = baseDensity + Math.cos(alpha) * amplitude;
            scene.fogDensity = BABYLON.Scalar.Clamp(d, 0.004, 0.06);
        });
    }

    setupNeonBloom() {
        const scene = this.scene;
        const camera = this.player?.camera || scene?.activeCamera;
        if (!scene || !camera) return;

        try {
            if (this._defaultPipeline) {
                this._defaultPipeline.dispose();
            }

            const pipeline = new DefaultRenderingPipeline(
                "defaultPipeline",
                true,
                scene,
                [camera]
            );

            pipeline.bloomEnabled = true;
            // Threshold was previously high to avoid the reflective floor.
            // With the matte asphalt ground, we can lower it so emissive neon contours actually glow.
            pipeline.bloomThreshold = 0.45;
            pipeline.bloomWeight = 0.85;
            pipeline.bloomKernel = 64;
            pipeline.bloomScale = 0.6;

            // Keep it simple: no extra FXAA/DOF here.
            this._defaultPipeline = pipeline;
        } catch {
            // noop
        }
    }

    createLights(scene) {
        this.light = new BABYLON.DirectionalLight("dir0", new BABYLON.Vector3(-0.5, -1, 0.2), scene);
        this.light.intensity = 1.25;
        this.light.position = new BABYLON.Vector3(550, 280, -300);

        this.scene.clearColor = new BABYLON.Color3(0, 0, 0);
    }

    beforeRenderUpdate() {
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;
        this.player.beforeRenderUpdate(this.deltaTime)
        this.mapBeforeRenderUpdate()
    }

    changeSceneBackground(scene) { }
    mapBeforeRenderUpdate() { }

}