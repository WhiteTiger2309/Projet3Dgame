import * as BABYLON from '@babylonjs/core'

import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import { Player } from './Player.js';

export class CreateMap {
    constructor(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        this.engine = engine;
        this.canvas = canvas;
        this.havokPlugin = havokPlugin;

        this.scene = this.createScene()
        this.createLights(this.scene)
        this.changeSceneBackground(this.scene)
        this.modifySettings(this.scene, this.canvas);
        this.createPlayer(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION);

        // Medium bloom for neon accents (post-process on the player camera).
        this.setupNeonBloom();
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

    createScene() {
        const scene = new BABYLON.Scene(this.engine);

        // Provide an IBL source so PBR materials have reasonable reflections.
        // Uses the existing equirectangular sky texture; safe fallback if it fails to load.
        try {
            if (!scene.environmentTexture) {
                scene.environmentTexture = new BABYLON.EquiRectangularCubeTexture(
                    "/assets/space/space1.png",
                    scene,
                    512
                );
                scene.environmentIntensity = 0.7;
            }
        } catch {
            // noop
        }

        scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.havokPlugin);

        scene.collisionsEnabled = false;

        scene.registerBeforeRender(() => {
            this.beforeRenderUpdate();
        })

        return scene;
    }

    createLights(scene) {
        const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.75;

        const dir = new BABYLON.DirectionalLight("dir0", new BABYLON.Vector3(-0.5, -1, 0.2), scene);
        dir.intensity = 1.25;
        dir.position = new BABYLON.Vector3(50, 80, -30);

        this.scene.clearColor = new BABYLON.Color3(0.8, 0.9, 1.0);
    }

    beforeRenderUpdate() {
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;
        this.player.beforeRenderUpdate()
        this.isPlayerOob()
        this.mapBeforeRenderUpdate()
    }

    createPlayer(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        this.player = new Player(this.scene, this.canvas, this, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)
    }

    modifySettings(scene, canvas) {
        scene.onPointerDown = () => {
            if (!scene.alreadyLocked) {
                canvas.requestPointerLock();
            }
        };

        document.addEventListener("pointerlockchange", () => {
            const element = document.pointerLockElement || null;
            scene.alreadyLocked = !!element;
        });
    }

    startRender() {
        this.engine.runRenderLoop(() => this.scene.render());
    }

    isPlayerOob() {
        if (this.player.player.position.y < -20) {
            this.player.respawn()
        }
    }

    changeSceneBackground(scene) { }
    mapBeforeRenderUpdate() { }

}