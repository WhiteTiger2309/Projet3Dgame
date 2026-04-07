import * as BABYLON from '@babylonjs/core'
import HavokPhysics from "@babylonjs/havok";
import '@babylonjs/loaders'

import { addTriggerObservable } from './utils/utils.js';
import { AssetsLoader } from './utils/AssetsLoader.js';
import '@babylonjs/core/Audio/audioEngine';
import '@babylonjs/core/Audio/audioSceneComponent';
import '@babylonjs/core/Audio/sound';
import '@babylonjs/core/Audio/soundTrack';
import '@babylonjs/core/Misc/assetsManager';

import { Map } from './Map.js';
import { Map2 } from './Map2.js';
import { MapTest } from './Map_test.js';
import { Player } from './Player.js';

export class Main {

    constructor() {
        this.canvas = document.querySelector("canvas");
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.assets = {}
        this.textures = {}
        this.materials = {}
        this.images = {}
        this.sounds = {}
        this.player = null
        this.observer = null
        this.ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), 2);

        window.addEventListener("resize", () => this.engine.resize())

        this.initGame()
    }

    async initGame() {
        this.havokInstance = await HavokPhysics();
        this.havokPlugin = new BABYLON.HavokPlugin(true, this.havokInstance);

        this.scene = this.createScene()
        this.assetsLoader = new AssetsLoader(this)
        this.createBaseLight();
        this.modifySettings();
        await this.assetsLoader.preloadAllAssets()

        this.startGame()
        addTriggerObservable(this.havokPlugin, this)
    }

    createScene() {
        const scene = new BABYLON.Scene(this.engine);

        scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.havokPlugin);

        scene.collisionsEnabled = false;

        return scene;
    }

    createBaseLight() {
        const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);
        hemi.intensity = 0.75;
    }

    modifySettings() {
        this.scene.onPointerDown = () => {
            if (!this.scene.alreadyLocked) {
                this.canvas.requestPointerLock();
            }
        };

        const checkIfPointerLocked = () => {
            const element = document.pointerLockElement || null;
            this.scene.alreadyLocked = !!element;
        };
        checkIfPointerLocked();
        document.addEventListener("pointerlockchange", checkIfPointerLocked)
    }

    async startGame() {
        this.createPlayer();

        this.map = new Map(this);
        await this.map.createMap()
        this.scene.registerBeforeRender(() => {
            this.map.beforeRenderUpdate();
        })
        this.startRender()
    }

    createPlayer() {
        this.player = new Player(this.scene, this)
    }

    startRender() {
        this.engine.runRenderLoop(() => {
            if (window.document.hasFocus()) {
                this.scene.render();
            }
        })
    }

}