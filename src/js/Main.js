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
        this.player = null
        this.observer = null
        this.ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), 2);
        this.assetsReady = false;
        this.isGameRunning = false;
        this.menuOverlay = null;
        this.menuStatus = null;
        this.menuStartButton = null;
        this.menuQuitButton = null;
        this.menuMusic = null;
        this.menuMusicStarted = false;
        this.menuAudioContext = null;
        this.menuAmbienceNodes = [];
        this.menuAmbienceStarted = false;

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
            this.setMenuStatus("Erreur pendant le chargement des ressources.");
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
        this.menuStatus = document.querySelector("#mainMenuStatus");
        this.menuStartButton = document.querySelector("#menuStartButton");
        this.menuQuitButton = document.querySelector("#menuQuitButton");

        this.setMenuButtonsEnabled(false);
        this.setMenuStatus("Chargement des ressources...");
        this.setHudVisible(false);

        this.menuOverlay?.addEventListener("pointerdown", () => this.ensureMenuAudioStarted());
        this.menuStartButton?.addEventListener("pointerenter", () => this.playMenuUiTone(880, 0.045));
        this.menuQuitButton?.addEventListener("pointerenter", () => this.playMenuUiTone(620, 0.035));
        this.menuStartButton?.addEventListener("click", () => this.onStartClicked());
        this.menuQuitButton?.addEventListener("click", () => this.quitGame());
    }

    setMenuStatus(message) {
        if (this.menuStatus) {
            this.menuStatus.textContent = message;
        }
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

    ensureMenuAudioStarted() {
        this.startMenuMusic();
    }

    scheduleMenuPing() {
        if (!this.menuAmbienceStarted) {
            return;
        }

        const pingAt = () => {
            if (!this.menuAmbienceStarted) {
                return;
            }

            this.playMenuUiTone(1240, 0.03, 0.008);
            window.setTimeout(pingAt, 14500 + Math.random() * 8000);
        };

        window.setTimeout(pingAt, 4500);
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
        this.menuAmbienceNodes.forEach((node) => {
            try {
                node.stop?.();
            } catch {
                // noop
            }

            try {
                node.disconnect?.();
            } catch {
                // noop
            }
        });
        this.menuAmbienceNodes = [];

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

        this.ensureMenuAudioStarted();
        this.playMenuUiTone(720, 0.06, 0.02);
        this.setMenuButtonsEnabled(false);
        this.setMenuStatus("Accès au pont principal...");

        try {
            this.stopMenuMusic();
            await this.startGame();
            this.stopMenuAudio();
            this.hideMenu();
            this.setHudVisible(true);
            this.setMenuStatus("Jeu lancé.");
        } catch (error) {
            console.error(error);
            this.setMenuStatus("Impossible de lancer la partie.");
            this.setMenuButtonsEnabled(true);
            this.isGameRunning = false;
        }
    }

    async startGame() {
        if (this.isGameRunning) {
            return;
        }

        this.isGameRunning = true;
        this.createPlayer();
        this.scene.activeCamera = this.player.camera;

        // this.sounds["ambientMusic"].play()
        // const ssao = new BABYLON.SSAO2RenderingPipeline('ssaopipeline', this.scene, { ssaoRatio: 0.5, blurRatio: 1.0 }, this.player.camera);

        this.map = new MapStart(this);
        // this.map = new MapLab(this);
        await this.map.createMap()
        this.scene.registerBeforeRender(() => {
            this.map.beforeRenderUpdate();
        })
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