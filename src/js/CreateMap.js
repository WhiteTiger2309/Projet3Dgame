import * as BABYLON from '@babylonjs/core'

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
    }

    createScene() {
        const scene = new BABYLON.Scene(this.engine);

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
    
    changeSceneBackground(scene){}
    mapBeforeRenderUpdate() {}

}