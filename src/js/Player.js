import * as BABYLON from '@babylonjs/core'

import { PlayerInput } from "./PlayerInput.js";
import { StateMachine } from "./playerStates/StateMachine.js";

export class Player {

    constructor(scene, canvas, map, respawnPos, SPAWN_ROTATION) {
        this.isGrounded = false;
        this.isSprinting = false;
        this.respawning = false
        this.groundDisableTimer = 0;
        this.jumpBufferTimer = 0;
        this.velocity = BABYLON.Vector3.Zero();
        this.inheritedVelocity = BABYLON.Vector3.Zero();
        this.heldMesh = null;
        this.isHoldingMesh = false;
        this.lastY = 0
        this.lastYCounter = 0
        this._audioUnlockBound = false;
        this._audioManagers = [];
        this.ambientMusic = null;
        this.ambientMusicReady = false;
        this.ambientMusicNative = null;
        this.ambientMusicNativeReady = false;
        this._ambientMusicNativeStarted = false;
        this._ambientMusicNativeUnlockTried = false;
        this._ambientMusicLastRetryAt = 0;
        this._ambientMusicStarted = false;

        this.scene = scene;
        this.canvas = canvas;
        this.map = map;

        this.stateMachine = new StateMachine(this)

        this.GRAVITY = this.map.scene._physicsEngine.gravity;

        this.WALK_SPEED = 4.5;
        this.SPRINT_SPEED = 5.7;
        this.JUMP_FORCE = 4.7;
        this.SENSITIVITY = 0.0008;
        this.MAX_SLOPE_ANGLE = 60;
        this.BASE_FOV = 1.1
        this.SPRINT_FOV = 1.3

        this.GROUND_DISABLE_TIME = 0.1;
        this.JUMP_BUFFER_TIME = 0.15;

        this.speed = this.WALK_SPEED;
        this.fov = this.BASE_FOV

        this.createPlayer(respawnPos, SPAWN_ROTATION)
        this.cameraRotation()

        this.input = new PlayerInput(scene);
        this.scene.audioEnabled = true;
        this.ensureBabylonAudioEngine();
        this.initAmbientMusic();
        this.initAmbientMusicNative();
        this.bindAudioUnlock();
        this.initFootstepAudio();
    }

    normalizeBinaryAudioData(data) {
        if (!data) return data;
        if (data instanceof ArrayBuffer) return data;
        if (ArrayBuffer.isView(data)) {
            const view = data;
            return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
        }
        return data;
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

    initAmbientMusic() {
        this.ambientMusic = new BABYLON.Sound(
            "ambientMusic",
            "/sounds/main_theme.mp3",
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

    initAmbientMusicNative() {
        const audio = new Audio("/sounds/main_theme.mp3");
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
        this._footstepReadyTimeout = null;
        this.footstepStepTimer = 0;
        this.footstepWalkInterval = 0.45;
        this.footstepSprintInterval = 0.30;

        this.footstepCandidates = [
            "/sounds/51124243-footstep-372877.mp3",
            "/sounds/footstep-safe.wav",
        ];

        this.initNativeFootstepFallback(0);
        this.loadFootstepCandidate(0);
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

    loadFootstepCandidate(index) {
        if (this._footstepReadyTimeout) {
            clearTimeout(this._footstepReadyTimeout);
            this._footstepReadyTimeout = null;
        }

        if (index >= this.footstepCandidates.length) {
            this.footstepSoundReady = false;
            return;
        }

        const url = this.footstepCandidates[index];
        this.footstepSoundReady = false;

        try {
            this.footstepSound?.dispose?.();
        } catch {
            // noop
        }

        const fallbackToNext = (_reason) => {
            this.loadFootstepCandidate(index + 1);
        };

        const manager = new BABYLON.AssetsManager(this.scene);
        this._audioManagers.push(manager);
        const task = manager.addBinaryFileTask(`footstepsBinary_${index}_${Date.now()}`, url);

        task.onSuccess = (binaryTask) => {
            let audioData = null;
            try {
                audioData = this.normalizeBinaryAudioData(binaryTask.data);
            } catch (error) {
                fallbackToNext(`normalisation binaire impossible (${String(error)})`);
                return;
            }

            this.footstepSound = new BABYLON.Sound(
                "footstepSafe",
                audioData,
                this.scene,
                () => {
                    this.footstepSoundReady = true;
                    this.footstepSound?.setVolume(0.8);
                    if (this._footstepReadyTimeout) {
                        clearTimeout(this._footstepReadyTimeout);
                        this._footstepReadyTimeout = null;
                    }
                },
                {
                    loop: false,
                    autoplay: false,
                    spatialSound: false,
                    streaming: false,
                }
            );
        };

        task.onError = (_binaryTask, message, exception) => {
            const reason = message || exception?.message || "task error";
            fallbackToNext(reason);
        };

        try {
            manager.load();
        } catch (error) {
            fallbackToNext(`AssetsManager.load() a echoue (${String(error)})`);
            return;
        }

        this._footstepReadyTimeout = setTimeout(() => {
            if (!this.footstepSoundReady) {
                fallbackToNext("timeout readiness");
            }
        }, 4500);
    }

    bindAudioUnlock() {
        if (this._audioUnlockBound) return;
        this._audioUnlockBound = true;

        const unlock = () => {
            this.tryUnlockAudioContext();
            this.tryStartAmbientMusic();
            this.tryStartAmbientMusicNative();
        };
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                unlock();
            }
        });

        // Certains navigateurs n'acceptent le resume audio que sur des evenements DOM globaux.
        const unlockOnGesture = () => {
            unlock();
            this.warmupAmbientMusicNative();
            this.warmupNativeFootstepMedia();
        };

        window.addEventListener("pointerdown", unlockOnGesture, { passive: true });
        window.addEventListener("keydown", unlockOnGesture, { passive: true });
        window.addEventListener("touchstart", unlockOnGesture, { passive: true });
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


    createPlayer(respawnPos, SPAWN_ROTATION) {
        let playerHeight = 1.8;
        let playerWidth = 1;
        if (respawnPos == undefined) {
            respawnPos = new BABYLON.Vector3(0, 3, 0)
        }
        this.respawnPos = respawnPos;

        this.player = new BABYLON.TransformNode("player", this.scene);
        this.player.isVisible = false;
        // this.player = BABYLON.MeshBuilder.CreateCapsule("player", { height: playerHeight, radius: playerWidth / 2 }, this.scene);
        // this.player.isVisible = true;

        this.player.position.copyFrom(respawnPos);

        this.character = new BABYLON.PhysicsCharacterController(respawnPos, { capsuleHeight: (playerHeight - 0.3), capsuleRadius: (playerWidth / 2) }, this.scene);

        this.head = new BABYLON.TransformNode("head", this.scene);
        this.head.position.y = 0.8;
        if (SPAWN_ROTATION == undefined) {
            SPAWN_ROTATION = BABYLON.Vector3.Zero();
        }
        this.SPAWN_ROTATION = SPAWN_ROTATION;
        this.head.rotation.copyFrom(SPAWN_ROTATION);
        this.head.parent = this.player;

        this.camera = new BABYLON.FreeCamera("camera", BABYLON.Vector3.Zero(), this.scene);
        this.camera.minZ = 0.1;
        this.camera.fov = this.fov

        this.pickRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero(), 4);

        this.camera.parent = this.head;


        // // // // temp camera pour debug commenter la ligne au dessus aussi
        // this.camera.attachControl(this.canvas);
        // this.camera.position = new BABYLON.Vector3(-6, 6, -13.8)
        // this.camera.setTarget(this.player.position)
        // this.camera.speed = 0.6;
        // this.camera.angularSensibility = 3000;
        // this.camera.inertia = 0.7;
        // var rayHelper = new BABYLON.RayHelper(this.pickRay);
        // rayHelper.show(this.scene);
        // // // //


        this.hand = new BABYLON.TransformNode("hand", this.scene);
        this.hand.parent = this.camera;
        this.hand.position = new BABYLON.Vector3(0, 0, 3);
    }

    cameraRotation() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && this.scene.alreadyLocked && this.stateMachine.checkIfCanMove()) {
                const event = pointerInfo.event;

                this.head.rotation.y += event.movementX * this.SENSITIVITY;
                this.camera.rotation.x += event.movementY * this.SENSITIVITY;

                this.camera.rotation.x = BABYLON.Scalar.Clamp(this.camera.rotation.x, -Math.PI / 2, Math.PI / 2);
            }
        });
    }

    // fonction appelé à chaque frame
    beforeRenderUpdate() {
        this.deltaTime = this.map.deltaTime;
        this.retryAmbientMusicIfNeeded();
        if (this.stateMachine.checkIfCanMove()) {
            this.updateGrounded();
            this.applyGravity();
            this.updateFromControls();
            this.updatePickRayPos();
            this.checkPickRayHit();
            this.updateHandPos();
        }
        this.updateHeldMeshPos();
        this.stateMachine.update();
        this.updateFootstepAudio();
    }

    updateFootstepAudio() {
        this.tryUnlockAudioContext();

        const canMove = this.stateMachine.checkIfCanMove();
        const moveSpeed2D = Math.hypot(this.velocity.x, this.velocity.z);
        const hasMoveInput =
            !!this.input?.inputMap?.["KeyW"] ||
            !!this.input?.inputMap?.["KeyA"] ||
            !!this.input?.inputMap?.["KeyS"] ||
            !!this.input?.inputMap?.["KeyD"];

        const shouldPlay =
            !this.respawning &&
            canMove &&
            (hasMoveInput || moveSpeed2D > 0.2);

        if (shouldPlay) {
            this.footstepStepTimer -= this.deltaTime;
            const interval = this.isSprinting ? this.footstepSprintInterval : this.footstepWalkInterval;

            if (this.footstepStepTimer <= 0) {
                this.footstepStepTimer = interval;
                try {
                    if (this.footstepSoundReady && this.footstepSound) {
                        if (this.footstepSound.isPlaying) {
                            this.footstepSound.stop();
                        }
                        this.footstepSound.play();
                    } else if (this.playNativeFootstep()) {
                    } else {
                        // Aucun sample pret: on attend la prochaine frame.
                    }
                } catch (error) {
                    // noop
                }
            }
        } else {
            this.footstepStepTimer = 0;
        }
    }


    updateFromControls() {
        // movement
        let inputX = this.input.horizontal || 0;
        let inputZ = this.input.vertical || 0;

        let forward = this.camera.getDirection(BABYLON.Axis.Z);
        let right = this.camera.getDirection(BABYLON.Axis.X);

        forward.y = 0;
        right.y = 0;

        forward.normalize();
        right.normalize();

        let move = BABYLON.Vector3.Zero();
        move.addInPlace(forward.scale(inputZ));
        move.addInPlace(right.scale(inputX));

        if (move.length() > 0) {
            move.normalize();
        }

        move = this.applyRampModification(move)
        this.applyCeilingHitModification();

        // apply movement
        if (this.isGrounded) {
            if (move.length() > 0) {
                this.velocity.x = move.x * this.speed;
                this.velocity.z = move.z * this.speed;
            }
            else {
                this.velocity.x = 0;
                this.velocity.z = 0;
                this.isSprinting = false;
            }
            this.lerpCameraTo(this.fov)
            this.velocity.addInPlace(this.supportInfo.averageSurfaceVelocity);
        }
        else if (this.isSprinting) {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 2);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 2);
        }
        else if (move.length() > 0) {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 3);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 3);
        }
        else {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 10);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 10);
        }

        this.character.moveWithCollisions(this.velocity.scale(this.deltaTime));
        this.player.position.copyFrom(this.character.getPosition());
    }

    applyRampModification(move) {
        if (this.isGrounded && this.groundNormal.y != 1) {
            move = this.projectOnPlane(move, this.groundNormal).normalize();

            const angle = Math.acos(BABYLON.Vector3.Dot(this.groundNormal, BABYLON.Vector3.Up()));
            const angleDeg = BABYLON.Tools.ToDegrees(angle);

            if (this.isGrounded && angleDeg < this.MAX_SLOPE_ANGLE) {
                if (move.y < 0) {
                    this.velocity.y += move.y * this.speed;
                }
                else {
                    const xzLength = Math.sqrt(move.x * move.x + move.z * move.z);
                    if (xzLength > 0) {
                        move.x /= xzLength;
                        move.z /= xzLength;
                        const lateralFactor = Math.cos(angle);
                        let right = this.camera.getDirection(BABYLON.Axis.X);
                        right.y = 0;
                        right.normalize();
                        const lateralDot = move.x * right.x + move.z * right.z;
                        move.x -= right.x * lateralDot * (1 - lateralFactor);
                        move.z -= right.z * lateralDot * (1 - lateralFactor);
                    }
                }
            }
            else {
                this.isGrounded = false;
            }
        }
        return move
    }

    projectOnPlane(vector, normal) {
        const dot = BABYLON.Vector3.Dot(vector, normal);
        return vector.subtract(normal.scale(dot));
    }

    applyGravity() {
        if (!this.isGrounded) {
            this.velocity.y += this.GRAVITY.y * this.deltaTime;
        }
        else {
            this.velocity.y = 0;
        }
    }

    updateGrounded() {
        if (this.groundDisableTimer > 0) {
            this.groundDisableTimer -= this.deltaTime;
            this.isGrounded = false;
            return;
        }
        this.supportInfo = this.character.checkSupport(this.deltaTime, this.GRAVITY.normalizeToNew());
        if (this.supportInfo.supportedState === BABYLON.CharacterSupportedState.SUPPORTED) {
            this.isGrounded = true;
            this.groundNormal = this.supportInfo.averageSurfaceNormal;
        }
        else {
            this.isGrounded = false;
            this.groundNormal = null;
        }
    }

    updatePickRayPos() {
        this.camera.getForwardRayToRef(this.pickRay, this.pickRay.length);
        this.pickRay.origin.copyFrom(this.head.getAbsolutePosition());
    }

    checkPickRayHit() {
        const pickInfo = this.scene.pickWithRay(this.pickRay);

        if (pickInfo.hit && pickInfo.pickedMesh.metadata?.isInteractable) {
            crosshair.style.display = 'block';
            if (pickInfo.pickedMesh.metadata?.onInteract && this.input.justPressed["KeyE"]) {
                pickInfo.pickedMesh.metadata.onInteract();
            }
        } else {
            crosshair.style.display = 'none';
        }
    }

    // à faire empecher le joueur de sauter sur l'objet tenu
    updateHandPos() {
        if (this.heldMesh) {
            const pickInfo = this.scene.pickWithRay(this.pickRay, (mesh) => {
                return !(mesh === this.heldMesh);
            });
            if (pickInfo.hit) {
                this.hand.position.z = Math.max(pickInfo.distance - 0.5, 1)
            }
            else {
                this.hand.position.z = 3
            }
        }
    }

    updateHeldMeshPos() {
        if (this.heldMesh) {
            crosshair.style.display = 'none';
            const aggregate = this.heldMesh.metadata.boxAggregate;
            aggregate.body.setAngularVelocity(BABYLON.Vector3.Zero());
            aggregate.body.setLinearVelocity(this.hand.getAbsolutePosition().subtract(this.heldMesh.getAbsolutePosition()).scale(20));

            if (this.input.justPressed["KeyE"] && this.isHoldingMesh) {
                this.dropHeldMesh(aggregate);
                return;
            }
            this.isHoldingMesh = true;
        }
    }

    dropHeldMesh(aggregate) {
        if (this.heldMesh) {
            if (aggregate == undefined) {
                aggregate = this.heldMesh.metadata.boxAggregate;
            }
            aggregate.body.setLinearVelocity(this.hand.getAbsolutePosition().subtract(this.heldMesh.getAbsolutePosition()).scale(2));
            this.heldMesh = null;
            this.isHoldingMesh = false;
        }
    }

    respawn() {
        if (!this.respawning) {
            this.respawning = true
            if (this.footstepSound?.isPlaying) {
                this.footstepSound.stop();
            }
            respawnOverlay.classList.add("fade-out");
            const fadeOutHandler = () => {
                respawnOverlay.removeEventListener("animationend", fadeOutHandler);

                this.dropHeldMesh();
                this.character.setPosition(this.respawnPos);
                this.velocity = BABYLON.Vector3.Zero();
                this.head.rotation.copyFrom(this.SPAWN_ROTATION);
                this.camera.rotation.x = 0;

                respawnOverlay.classList.remove("fade-out");
                respawnOverlay.classList.add("fade-in");

                const fadeInHandler = () => {
                    respawnOverlay.removeEventListener("animationend", fadeInHandler);

                    respawnOverlay.classList.remove("fade-in");
                    this.respawning = false;
                };

                respawnOverlay.addEventListener("animationend", fadeInHandler);
            };

            respawnOverlay.addEventListener("animationend", fadeOutHandler);
        }
    }

    lerpCameraTo(fov) {
        this.camera.fov = BABYLON.Lerp(this.camera.fov, fov, this.deltaTime * 5.0);
    }

    applyCeilingHitModification() {
        if (!this.isGrounded && this.velocity.y > 0.1) {
            if (Math.abs(this.lastY - this.character._position.y) < 0.001) {
                this.lastYCounter += 1
            }
            else {
                this.lastYCounter = 0
            }
            if (this.lastYCounter >= 2) {
                this.velocity.y = 0
            }
            this.lastY = this.character._position.y
        }
    }
}