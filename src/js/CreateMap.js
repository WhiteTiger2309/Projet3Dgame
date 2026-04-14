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
        this.setupFog();
        // // Medium bloom for neon accents (post-process on the player camera).
        this.setupNeonBloom();

        this.player.resetPos()
    }

    setupFog() {
        // Inspired by the Babylon.js fog example:
        // use EXP fog with a small animated density to make the environment feel alive.
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;

        // Fog color: prefer ambientColor (usually closer to the perceived haze),
        // because clearColor can be near-black in space scenes and makes fog imperceptible.
        const ac = this.scene.ambientColor;
        const useAmbient = ac && (ac.r + ac.g + ac.b) > 0.05;
        const src = useAmbient ? ac : this.scene.clearColor;
        this.scene.fogColor = new BABYLON.Color3(src.r, src.g, src.b);

        // Base density tuned for the current scale (ground width ~180).
        // Increase for thicker fog, decrease for subtler depth cue.
        const baseDensity = 0.0016;
        const amplitude = 0.0006;
        const speed = 0.05; // cycles/sec-ish (driven by deltaTime)

        this.scene.fogDensity = baseDensity;

        if (this._fogObserver) {
            this.scene.onBeforeRenderObservable.remove(this._fogObserver);
            this._fogObserver = null;
        }

        let alpha = 0;
        this._fogObserver = this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000;
            alpha += dt * speed;
            const d = baseDensity + Math.cos(alpha) * amplitude;
            this.scene.fogDensity = BABYLON.Scalar.Clamp(d, 0.004, 0.06);
        });
    }

    setupNeonBloom() {
        const camera = this.player?.camera || this.scene?.activeCamera;
        if (!this.scene || !camera) return;

        try {
            if (this._defaultPipeline) {
                this._defaultPipeline.dispose();
            }

            const pipeline = new DefaultRenderingPipeline(
                "defaultPipeline",
                true,
                this.scene,
                [camera]
            );

            pipeline.bloomEnabled = true;
            // Threshold was previously high to avoid the reflective floor.
            // With the matte asphalt ground, we can lower it so emissive neon contours actually glow.
            pipeline.bloomThreshold = 0.75;
            pipeline.bloomWeight = 0.35;
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