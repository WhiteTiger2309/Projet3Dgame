import * as BABYLON from '@babylonjs/core'
import HavokPhysics from "@babylonjs/havok";
import '@babylonjs/loaders'

import "@babylonjs/core/Shaders/selectionOutline.fragment";
import "@babylonjs/core/Shaders/selection.fragment";
import "@babylonjs/core/Shaders/selection.vertex";

import { addTriggerObservable } from './utils/utils.js';
import { AssetsLoader } from './utils/AssetsLoader.js';

import { MapStart } from './MapStart.js';
import { MapLab } from './MapLab.js';
import { MapTest } from './Map_test.js';
import { MapLazer } from './Map_lazer.js';
import { Player } from './Player.js';
import { SoundManager } from './utils/SoundManager.js';
import { MapLazer3 } from './Map_lazer3.js';
import { MapLazer1 } from './Map_lazer1.js';
import { MapLazer2 } from './Map_lazer2.js';
import { MapLazer4 } from './Map_lazer4.js';
import { MapPuzzle1 } from './MapPuzzle1.js';
import { MapPuzzle2 } from './MapPuzzle2.js';
import { MapFin } from './MapFin.js';
import { MapMix } from './MapMix.js';

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
        this.assetsReady = false;
        this.isGameRunning = false;
        this.menuOverlay = null;
        this.endOverlay = null;
        this.menuStartButton = null;
        this.menuQuitButton = null;
        this.endQuitButton = null;
        this.menuMusic = null;
        this.menuMusicStarted = false;
        this.menuAudioContext = null;
        this.menuAmbienceStarted = false;
        this.menuCamera = null;
        this.mapBeforeRenderObserver = null;

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
        this.setupMenu();
        this.startRender();

        try {
            await this.assetsLoader.preloadAllAssets()
            this.assetsReady = true;
            this.menuMusic = this.sounds["menuMusic"] || null;
            this.setMenuButtonsEnabled(true);
            this.startMenuMusic();
        } catch (error) {
            console.error(error);
            this.setMenuButtonsEnabled(false);
            return;
        }
        // Ne pas bloquer le démarrage sur les contraintes autoplay.
        // SoundManager tentera l'unlock + lecture sur geste utilisateur.
        await this.audioEngine.unlockAsync().catch(() => {});
        addTriggerObservable(this.havokPlugin, this)
    }

    createScene() {
        const scene = new BABYLON.Scene(this.engine);

        scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.havokPlugin);

        scene.collisionsEnabled = false;

        const camera = new BABYLON.FreeCamera("menuCamera", new BABYLON.Vector3(0, 1.5, -8), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        scene.activeCamera = camera;
        this.menuCamera = camera;

        return scene;
    }

    createBaseLight() {
        this.mainLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.mainLight.intensity = 0.75;
    }

    modifySettings() {
        this.scene.onPointerDown = () => {
            if (!this.isGameRunning) {
                return;
            }
            if (!this.scene.alreadyLocked) {
                this.canvas.requestPointerLock();
                this.canvas.focus()
            }
        };

        const checkIfPointerLocked = () => {
            const element = document.pointerLockElement || null;
            this.scene.alreadyLocked = !!element;
        };
        checkIfPointerLocked();
        document.addEventListener("pointerlockchange", checkIfPointerLocked)
    }

    setupMenu() {
        this.menuOverlay = document.querySelector("#mainMenu");
        this.endOverlay = document.querySelector("#endMenu");
        this.menuStartButton = document.querySelector("#menuStartButton");
        this.menuQuitButton = document.querySelector("#menuQuitButton");
        this.endQuitButton = document.querySelector("#endMenuQuitButton");

        this.setMenuButtonsEnabled(false);
        this.hideEndMenu();
        this.setHudVisible(false);

        this.menuStartButton?.addEventListener("pointerenter", () => this.playMenuUiTone(880, 0.045));
        this.menuQuitButton?.addEventListener("pointerenter", () => this.playMenuUiTone(620, 0.035));
        this.endQuitButton?.addEventListener("pointerenter", () => this.playMenuUiTone(620, 0.035));
        this.menuStartButton?.addEventListener("click", () => this.onStartClicked());
        this.menuQuitButton?.addEventListener("click", () => this.quitGame());
        this.endQuitButton?.addEventListener("click", () => this.quitGame());
    }

    setMenuButtonsEnabled(enabled) {
        if (this.menuStartButton) {
            this.menuStartButton.disabled = !enabled;
            this.menuStartButton.textContent = enabled ? "Start" : "Chargement...";
        }
    }

    setHudVisible(visible) {
        const crosshair = document.querySelector("#crosshair");
        if (crosshair) {
            crosshair.style.display = visible ? "block" : "none";
        }
    }

    hideMenu() {
        this.menuOverlay?.classList.add("hidden");
    }

    showMenu() {
        this.endOverlay?.classList.add("hidden");
        this.menuOverlay?.classList.remove("hidden");
    }

    hideEndMenu() {
        this.endOverlay?.classList.add("hidden");
    }

    showEndMenu() {
        this.menuOverlay?.classList.add("hidden");
        this.endOverlay?.classList.remove("hidden");
    }

    playMenuUiTone(frequency, duration, volume = 0.018) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return;
        }

        this.menuAudioContext = this.menuAudioContext || new AudioContextClass();
        const context = this.menuAudioContext;

        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;

        filter.type = "highpass";
        filter.frequency.value = 250;

        gain.gain.value = 0;

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);

        const now = context.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration, 0.05));

        oscillator.start(now);
        oscillator.stop(now + Math.max(duration, 0.05) + 0.02);
    }

    stopMenuAudio() {
        this.stopMenuMusic();
        this.menuAmbienceStarted = false;

        if (this.menuAudioContext && this.menuAudioContext.state !== "closed") {
            try {
                this.menuAudioContext.close();
            } catch {
                // noop
            }
        }
        this.menuAudioContext = null;
    }

    startMenuMusic() {
        const music = this.menuMusic || this.sounds["menuMusic"];
        if (!music || this.menuMusicStarted) {
            return;
        }

        try {
            music.stop();
        } catch {
            // noop
        }

        try {
            music.loop = true;
            music.setVolume?.(0.05);
            music.play();
            this.menuMusicStarted = true;
        } catch {
            this.menuMusicStarted = false;
        }
    }

    stopMenuMusic() {
        const music = this.menuMusic || this.sounds["menuMusic"];
        if (!music) {
            return;
        }

        try {
            music.stop();
        } catch {
            // noop
        }

        this.menuMusicStarted = false;
    }

    async onStartClicked() {
        if (!this.assetsReady || this.isGameRunning) {
            return;
        }

        this.playMenuUiTone(720, 0.06, 0.02);
        this.setMenuButtonsEnabled(false);
        this.hideEndMenu();

        try {
            this.stopMenuMusic();
            await this.startGame();
            this.stopMenuAudio();
            this.hideMenu();
            this.setHudVisible(true);
        } catch (error) {
            console.error(error);
            this.setMenuButtonsEnabled(true);
            this.isGameRunning = false;
        }
    }

    async startGame() {
        if (this.isGameRunning) {
            return;
        }

        this.disposeCurrentGame();

        this.isGameRunning = true;
        this.scene.simulatePointerDown(this.canvas)

        this.createPlayer();
        this.scene.activeCamera = this.player.camera;

        // this.sounds["ambientMusic"].play()
        // const ssao = new BABYLON.SSAO2RenderingPipeline('ssaopipeline', this.scene, { ssaoRatio: 0.5, blurRatio: 1.0 }, this.player.camera);

        this.map = new MapStart(this);
        // this.map = new MapLab(this);
        await this.map.createMap()
        if (this.mapBeforeRenderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.mapBeforeRenderObserver);
        }
        this.mapBeforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (!this.isGameRunning) {
                return;
            }

            this.map?.beforeRenderUpdate();
        })
    }

    returnToMainMenu() {
        this.isGameRunning = false;

        if (this.mapBeforeRenderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.mapBeforeRenderObserver);
            this.mapBeforeRenderObserver = null;
        }

        this.disposeCurrentGame();

        this.scene.activeCamera = this.menuCamera || this.scene.activeCamera;
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }

        this.setHudVisible(false);
        this.showMenu();
        this.setMenuButtonsEnabled(!!this.assetsReady);
        this.stopMenuAudio();
        this.startMenuMusic();
    }

    returnToEndMenu() {
        this.isGameRunning = false;

        if (this.mapBeforeRenderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.mapBeforeRenderObserver);
            this.mapBeforeRenderObserver = null;
        }

        this.disposeCurrentGame();

        this.scene.activeCamera = this.menuCamera || this.scene.activeCamera;
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }

        this.setHudVisible(false);
        this.hideMenu();
        this.showEndMenu();
        this.stopMenuAudio();
        this.startMenuMusic();
    }

    disposeCurrentGame() {
        const safeDispose = (entity) => {
            if (entity && typeof entity.dispose === "function") {
                try {
                    entity.dispose();
                } catch {
                    // noop
                }
            }
        };

        if (this.player) {
            safeDispose(this.player.connectionManager?.previewLine);
            safeDispose(this.player.connectionManager?.highlightLayer);
            safeDispose(this.player.connectionManager?.connectionOutline);
            safeDispose(this.player.connectionManager?.outliner);
            safeDispose(this.player.highlight);
            safeDispose(this.player.outliner);
            safeDispose(this.player.line);
            safeDispose(this.player.camera);
            safeDispose(this.player.hand);
            safeDispose(this.player.head);
            safeDispose(this.player.player);
            safeDispose(this.player.character);
            this.player = null;
        }

        this.map = null;

        this.scene.effectLayers.slice().forEach((layer) => {
            safeDispose(layer);
        });

        this.scene.meshes.slice().forEach((mesh) => {
            safeDispose(mesh);
        });

        this.scene.transformNodes.slice().forEach((node) => {
            safeDispose(node);
        });

        this.scene.lights.slice().forEach((light) => {
            if (light !== this.mainLight) {
                safeDispose(light);
            }
        });

        if (this.mainLight) {
            this.mainLight.intensity = 0.75;
            this.mainLight.direction = new BABYLON.Vector3(0, 1, 0);
        }
    }

    createPlayer() {
        this.player = new Player(this)
    }

    quitGame() {
        try {
            window.close();
        } catch {
            // noop
        }

        if (!window.closed) {
            window.location.replace("about:blank");
        }
    }

    startRender() {
        this.engine.runRenderLoop(() => {
            if (window.document.hasFocus()) {
                this.scene.render();
            }
        })
    }

}