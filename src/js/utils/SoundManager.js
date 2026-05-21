import * as BABYLON from '@babylonjs/core'
const BASE = import.meta.env.BASE_URL || '/';

export class SoundManager {

    constructor(main) {
        this.main = main;
        this.scene = main.scene;

        this._audioUnlockBound = false;
        this._unlockOnGestureBound = null;
        this._scenePointerObserver = null;

        // Music state
        this.ambientMusic = null;
        this.ambientMusicReady = false;
        this.ambientMusicNative = null;
        this.ambientMusicNativeReady = false;
        this._ambientMusicStarted = false;
        this._ambientMusicNativeStarted = false;
        this._ambientMusicNativeUnlockTried = false;
        this._ambientMusicLastRetryAt = 0;

        // Footsteps state
        this.footstepSound = null;
        this.footstepSoundReady = false;
        this.footstepNativeAudio = null;
        this.footstepNativeReady = false;
        this._footstepNativeUrl = null;
        this._footstepNativeUnlockTried = false;

        this.footstepCandidates = [
            BASE + "sounds/51124243-footstep-372877.mp3",
            BASE + "sounds/footstep-safe.wav",
        ];
    }

    init() {
        if (!this.scene) return;

        this.scene.audioEnabled = true;
        this.ensureBabylonAudioEngine();

        this.initAmbientMusic();
        this.initAmbientMusicNative();

        this.initFootstepAudio();

        this.bindAudioUnlock();
    }

    dispose() {
        if (this._scenePointerObserver && this.scene?.onPointerObservable) {
            try {
                this.scene.onPointerObservable.remove(this._scenePointerObserver);
            } catch {
                // noop
            }
            this._scenePointerObserver = null;
        }

        if (this._unlockOnGestureBound) {
            try {
                window.removeEventListener("pointerdown", this._unlockOnGestureBound);
                window.removeEventListener("keydown", this._unlockOnGestureBound);
                window.removeEventListener("touchstart", this._unlockOnGestureBound);
            } catch {
                // noop
            }
            this._unlockOnGestureBound = null;
        }

        try {
            this.ambientMusic?.dispose?.();
        } catch {
            // noop
        }
        try {
            this.footstepSound?.dispose?.();
        } catch {
            // noop
        }

        this.ambientMusic = null;
        this.footstepSound = null;
    }

    beforeRenderUpdate(_deltaTime) {
        this.retryAmbientMusicIfNeeded();
    }

    ensureBabylonAudioEngine() {
        // Initialisation explicite pour eviter un audioEngine absent selon le bundling ESM.
        if (!BABYLON.Engine.audioEngine && BABYLON.AudioEngine) {
            BABYLON.Engine.audioEngine = new BABYLON.AudioEngine();
        }

        try {
            BABYLON.Engine.audioEngine?.setGlobalVolume?.(1);
        } catch {
            // noop
        }
    }

    tryUnlockAudioContext() {
        this.ensureBabylonAudioEngine();
        const audioEngine = BABYLON.Engine.audioEngine;

        try {
            audioEngine?.unlock?.();
            audioEngine?.audioContext?.resume?.();
            audioEngine?.setGlobalVolume?.(1);
        } catch {
            // Ignore: certains navigateurs exigent une interaction utilisateur stricte.
        }
    }

    bindAudioUnlock() {
        if (this._audioUnlockBound) return;
        this._audioUnlockBound = true;

        const unlock = () => {
            this.tryUnlockAudioContext();
            this.tryStartAmbientMusic();
            this.tryStartAmbientMusicNative();
        };

        if (this.scene?.onPointerObservable) {
            this._scenePointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
                if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                    unlock();
                }
            });
        }

        // Certains navigateurs n'acceptent le resume audio que sur des evenements DOM globaux.
        this._unlockOnGestureBound = () => {
            unlock();
            this.warmupAmbientMusicNative();
            this.warmupNativeFootstepMedia();
        };

        window.addEventListener("pointerdown", this._unlockOnGestureBound, { passive: true });
        window.addEventListener("keydown", this._unlockOnGestureBound, { passive: true });
        window.addEventListener("touchstart", this._unlockOnGestureBound, { passive: true });
    }

    getPreloadedBuffer(name) {
        return this.main?.soundBuffers?.[name] || null;
    }

    initAmbientMusic() {
        // Prefer preloaded buffer from AssetsLoader.
        const buf = this.getPreloadedBuffer("ambientMusic");
        if (buf) {
            this.ambientMusic = new BABYLON.Sound(
                "ambientMusic",
                buf,
                this.scene,
                () => {
                    this.ambientMusicReady = true;
                    this.ambientMusic?.setVolume(0.5);
                    this.tryStartAmbientMusic();
                },
                {
                    loop: true,
                    autoplay: false,
                    spatialSound: false,
                    streaming: false,
                }
            );
        } else {
            // Fallback to streaming URL (legacy behavior).
            this.ambientMusic = new BABYLON.Sound(
                "ambientMusic",
                BASE + "sounds/main_theme.mp3",
                this.scene,
                () => {
                    this.ambientMusicReady = true;
                    this.ambientMusic?.setVolume(0.5);
                    this.tryStartAmbientMusic();
                },
                {
                    loop: true,
                    autoplay: false,
                    spatialSound: false,
                    streaming: true,
                }
            );
        }

        // Keep compatibility cache.
        if (this.main?.sounds) {
            this.main.sounds["ambientMusic"] = this.ambientMusic;
        }
    }

    initAmbientMusicNative() {
        const audio = new Audio(BASE + "sounds/main_theme.mp3");
        audio.preload = "auto";
        audio.loop = true;
        audio.volume = 0.07;
        this.ambientMusicNative = audio;
        this.ambientMusicNativeReady = true;

        audio.addEventListener("canplay", () => {
            this.ambientMusicNativeReady = true;
            this.tryStartAmbientMusicNative();
        });

        audio.addEventListener("loadeddata", () => {
            this.ambientMusicNativeReady = true;
        });

        try {
            audio.load();
        } catch {
            // noop
        }
    }

    async warmupAmbientMusicNative() {
        if (!this.ambientMusicNativeReady || !this.ambientMusicNative || this._ambientMusicNativeUnlockTried) {
            return;
        }

        // If music is already started (or currently playing), never interrupt it.
        if (this._ambientMusicNativeStarted) return;
        try {
            if (!this.ambientMusicNative.paused && !this.ambientMusicNative.ended) {
                return;
            }
        } catch {
            // noop
        }

        this._ambientMusicNativeUnlockTried = true;

        try {
            const a = this.ambientMusicNative;
            const prevMuted = a.muted;
            const prevTime = a.currentTime;

            a.muted = true;
            a.currentTime = 0;
            await a.play();
            a.pause();
            a.currentTime = prevTime;
            a.muted = prevMuted;
        } catch {
            // noop
        }
    }

    tryStartAmbientMusicNative() {
        if (this._ambientMusicNativeStarted || !this.ambientMusicNative) return;

        try {
            this.ambientMusicNative.currentTime = 0;
            const playPromise = this.ambientMusicNative.play();
            if (playPromise && typeof playPromise.then === "function") {
                playPromise
                    .then(() => {
                        this._ambientMusicNativeStarted = true;
                    })
                    .catch(() => {
                        this._ambientMusicNativeStarted = false;
                    });
            } else {
                this._ambientMusicNativeStarted = true;
            }
        } catch {
            // noop
        }
    }

    retryAmbientMusicIfNeeded() {
        // Keep trying until native starts at least once.
        if (this._ambientMusicNativeStarted) return;

        const now = Date.now();
        if (now - this._ambientMusicLastRetryAt < 1500) return;
        this._ambientMusicLastRetryAt = now;

        this.tryUnlockAudioContext();
        this.tryStartAmbientMusic();
        this.tryStartAmbientMusicNative();
    }

    tryStartAmbientMusic() {
        if (this._ambientMusicStarted || !this.ambientMusicReady || !this.ambientMusic) {
            this.tryStartAmbientMusicNative();
            return;
        }

        try {
            this.ambientMusic.play();
            this._ambientMusicStarted = true;
        } catch {
            this.tryStartAmbientMusicNative();
        }
    }

    initFootstepAudio() {
        this.footstepSound = null;
        this.footstepSoundReady = false;
        this.footstepNativeAudio = null;
        this.footstepNativeReady = false;
        this._footstepNativeUrl = null;
        this._footstepNativeUnlockTried = false;

        // Prefer preloaded binary candidates.
        const buf0 = this.getPreloadedBuffer("footstep_0");
        const buf1 = this.getPreloadedBuffer("footstep_1");

        const tryCreate = (buf) => {
            if (!buf) return null;
            try {
                return new BABYLON.Sound(
                    "footstepSafe",
                    buf,
                    this.scene,
                    () => {
                        this.footstepSoundReady = true;
                        this.footstepSound?.setVolume(0.8);
                    },
                    {
                        loop: false,
                        autoplay: false,
                        spatialSound: false,
                        streaming: false,
                    }
                );
            } catch {
                return null;
            }
        };

        this.footstepSound = tryCreate(buf0) || tryCreate(buf1);
        if (this.main?.sounds && this.footstepSound) {
            this.main.sounds["footstepSafe"] = this.footstepSound;
        }

        this.initNativeFootstepFallback(0);
    }

    initNativeFootstepFallback(index) {
        if (index >= this.footstepCandidates.length) {
            this.footstepNativeReady = false;
            return;
        }

        const url = this.footstepCandidates[index];
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";

        const onNativeReady = () => {
            this.footstepNativeAudio = audio;
            this.footstepNativeReady = true;
            this._footstepNativeUrl = url;
        };

        const onNativeError = () => {
            this.initNativeFootstepFallback(index + 1);
        };

        audio.addEventListener("canplaythrough", onNativeReady, { once: true });
        audio.addEventListener("error", onNativeError, { once: true });

        try {
            audio.load();
        } catch {
            onNativeError();
        }
    }

    async warmupNativeFootstepMedia() {
        if (!this.footstepNativeReady || !this.footstepNativeAudio || this._footstepNativeUnlockTried) {
            return;
        }
        this._footstepNativeUnlockTried = true;

        try {
            const a = this.footstepNativeAudio;
            const prevMuted = a.muted;
            const prevTime = a.currentTime;

            a.muted = true;
            a.currentTime = 0;
            await a.play();
            a.pause();
            a.currentTime = prevTime;
            a.muted = prevMuted;
        } catch {
            // noop
        }
    }

    playNativeFootstep() {
        if (!this.footstepNativeReady || !this.footstepNativeAudio) return false;

        try {
            const shot = this.footstepNativeAudio.cloneNode(true);
            shot.volume = 0.8;
            shot.currentTime = 0;
            shot.play().catch(() => {
                // noop
            });
            return true;
        } catch {
            return false;
        }
    }

    playFootstep() {
        // Keep trying to unlock silently for browsers that are picky.
        this.tryUnlockAudioContext();

        try {
            if (this.footstepSoundReady && this.footstepSound) {
                if (this.footstepSound.isPlaying) {
                    this.footstepSound.stop();
                }
                this.footstepSound.play();
                return true;
            }

            if (this.playNativeFootstep()) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }
}
