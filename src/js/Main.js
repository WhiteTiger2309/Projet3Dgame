import * as BABYLON from '@babylonjs/core'
import HavokPhysics from "@babylonjs/havok";
import '@babylonjs/loaders'

import "@babylonjs/core/Shaders/selectionOutline.fragment";
import "@babylonjs/core/Shaders/selection.fragment";
import "@babylonjs/core/Shaders/selection.vertex";

import { addTriggerObservable } from './utils/utils.js';
import { AssetsLoader } from './utils/AssetsLoader.js';

import { Map } from './Map.js';
import { MapStart } from './MapStart.js';
import { MapLab } from './MapLab.js';
import { MapTest } from './Map_test.js';
import { MapLazer } from './Map_lazer.js';
import { Player } from './Player.js';
import { SoundManager } from './utils/SoundManager.js';

export class Main {

    constructor() {
        this.canvas = document.querySelector("canvas");
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.assets = {}
        this.textures = {}
        this.materials = {}
        this.images = {}
        this.sounds = {}
        this.soundBuffers = {}
        this.sound = null
        this.player = null
        this.observer = null
        this.ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), 2);

        window.addEventListener("resize", () => this.engine.resize())

        this.initGame()
    }

    async initGame() {
        this.havokInstance = await HavokPhysics();
        this.havokPlugin = new BABYLON.HavokPlugin(true, this.havokInstance);
        this.audioEngine = await BABYLON.CreateAudioEngineAsync();

        this.scene = this.createScene()
        this.assetsLoader = new AssetsLoader(this)
        this.createBaseLight();
        this.modifySettings();

        await this.assetsLoader.preloadAllAssets()
        // Ne pas bloquer le démarrage sur les contraintes autoplay.
        // SoundManager tentera l'unlock + lecture sur geste utilisateur.
        this.audioEngine.unlockAsync().catch(() => {});

        this.sound = new SoundManager(this)
        this.sound.init()

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
        this.mainLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.mainLight.intensity = 0.75;
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

        // this.sounds["music"].play()
        // const ssao = new BABYLON.SSAO2RenderingPipeline('ssaopipeline', this.scene, { ssaoRatio: 0.5, blurRatio: 1.0 }, this.player.camera);

        // this.map = new MapStart(this);
        this.map = new MapLab(this);
        await this.map.createMap()
        this.scene.registerBeforeRender(() => {
            this.map.beforeRenderUpdate();
        })
        this.startRender()
    }

    createPlayer() {
        this.player = new Player(this)
    }

    startRender() {
        this.engine.runRenderLoop(() => {
            if (window.document.hasFocus()) {
                this.scene.render();
            }
        })
    }

}