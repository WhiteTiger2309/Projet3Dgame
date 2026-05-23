import * as BABYLON from '@babylonjs/core'

import { addStaticPhysics, createDiegeticTeleportMarker, createMapChangeGate, createMeshFromAsset, placeOnMesh } from './utils/utils.js';
import { createEmissiveStripTexture } from './utils/materials.js';
import { Robot } from './Robot.js';
import { MapLazer } from './Map_lazer.js';
import { MapLab } from './MapLab.js';
import { ElectricPuzzle } from './ElectricPuzzle.js';
import { MapFin } from './MapFin.js';

export class MapLazer4 extends MapLazer {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION);

        // Mini-map: 2 salles (puzzle combo + sortie)
        this.ROOM_COUNT = 2;
        this.CORRIDOR_LENGTH = this.ROOM_COUNT * this.ROOM_LENGTH;
        this.ROOM0_CENTER_X = (-this.CORRIDOR_LENGTH / 2) + (this.ROOM_LENGTH / 2);

        // Porte: sur une mini-map, on laisse plus de temps pour traverser.
        this.DOOR_CLOSE_DELAY_S = 4.0;

        // Spawn en salle puzzle
        this.player.respawnPos = new BABYLON.Vector3(this.ROOM0_CENTER_X - 6, 2, 0);
        this.player.respawnRotation = 1.57;
        this.player.resetPos();

        this.electricPuzzle = null;
        this._comboEmitterId = 'r10_combo_emitter';
        this._comboSensorId = 'r10_combo_sensor';
    }

    createMap() {
        super.createMap();

        this.robot = new Robot(
            this.main,
            new BABYLON.Vector3(this.roomCenterX(0) - 6.2, 1.2, 6.2),
            0,
            'DialogLazer4'
        )

        
        const gatePos = new BABYLON.Vector3(this.roomBoundaryX(0) + 2.4, 0, 0);
        createMapChangeGate(this.main, MapFin, gatePos, undefined, 90);

        createDiegeticTeleportMarker(this.scene, gatePos, 'lazer4');
    }

    mapBeforeRenderUpdate() {
        this._now = (this._now || 0) + (this.deltaTime || 0);

        this.updateKeyEdges();
        if (this.handleManualReset()) return;

        // Combo: l'électricité doit être évaluée avant le laser.
        if (this.electricPuzzle) {
            this.electricPuzzle.updateElectricity();
            this.syncElectricToLaser();
        }

        this.updateLaserControls();
        this.updateRoomAnimations();
        this.updateLaserSystem();
        this.evaluatePuzzleLogic();
        this.updateDoors();
    }

    handleManualReset() {
        const did = super.handleManualReset();
        if (did) {
            this.electricPuzzle?.reset();
            this.syncElectricToLaser();
        }
        return did;
    }

    syncElectricToLaser() {
        const solved = !!this.electricPuzzle?.isSolved();
        const emitter = (this.emitters || []).find((e) => e?.id === this._comboEmitterId);
        if (emitter) {
            emitter.enabled = solved;

            // Indicateur simple: emitter très dim quand OFF.
            if (emitter.mat && emitter.baseEmissive) {
                const base = emitter.baseEmissive;
                emitter.mat.emissiveColor = solved ? base.clone() : base.scale(0.12);
            }
        }

        if (!solved && this.laserControl?.active?.type === 'emitter' && this.laserControl?.active?.id === this._comboEmitterId) {
            this.laserControl.active = null;
            this.updateLaserControlVisuals();
        }

        this._electricSolved = solved;
    }

    createLightingAccent(scene) {
        const hemi = new BABYLON.HemisphericLight('hemiFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.34;

        const dir = new BABYLON.DirectionalLight('dirMain', new BABYLON.Vector3(-0.35, -1, 0.2), scene);
        dir.intensity = 0.75;
        dir.position = new BABYLON.Vector3(20, 45, -12);

        const lightXs = [this.roomCenterX(0), this.roomCenterX(1)];
        const colors = [
            new BABYLON.Color3(0.95, 0.55, 0.2),
            new BABYLON.Color3(0.2, 0.7, 1.0),
        ];

        for (let i = 0; i < lightXs.length; i += 1) {
            const p = new BABYLON.PointLight(`room_light_${i}`, new BABYLON.Vector3(lightXs[i], 4.2, 0), scene);
            p.diffuse = colors[i];
            p.intensity = 2.8;
            p.range = 28;
        }
    }

    createPuzzleRooms(scene) {
        const doorSize = new BABYLON.Vector3(this.WALL_THICKNESS, this.WALL_HEIGHT, this.DOOR_GAP_DEPTH);
        this.doors = [];

        for (let i = 0; i < this.ROOM_COUNT - 1; i += 1) {
            const x = this.roomBoundaryX(i);
            const door = this.createSlidingDoor(`door_${i + 1}`, new BABYLON.Vector3(x, this.WALL_HEIGHT / 2, 0), doorSize);
            door.openUntil = 0;
            this.doors.push(door);
        }

        // Obstacle: bloque la ligne droite, force l'utilisation du miroir.
        const c0 = this.roomCenterX(0);
        const blocker = BABYLON.MeshBuilder.CreateBox('combo_blocker', { width: 1.2, height: 3.6, depth: 10.0 }, scene);
        blocker.position = new BABYLON.Vector3(c0 + 1.2, 1.8, 0);
        blocker.isPickable = false;
        const mat = new BABYLON.StandardMaterial('combo_blocker_mat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.18, 0.19, 0.22);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.04);
        mat.specularColor = BABYLON.Color3.Black();
        blocker.material = mat;
        blocker.metadata = { ...(blocker.metadata || {}), laserBlocker: true };
        addStaticPhysics(blocker, 'BOX');
    }

    createLaserSystem(scene) {
        this.ensureLaserBeamShaders();

        const createLaserMaterial = (name, { baseColor, emissiveColor, emissiveTexture }) => {
            const mat = new BABYLON.StandardMaterial(name, scene);
            mat.diffuseColor = baseColor;
            mat.emissiveColor = emissiveColor;
            mat.specularColor = BABYLON.Color3.Black();
            if (emissiveTexture) {
                mat.emissiveTexture = emissiveTexture;
            }
            return mat;
        };

        // Nettoyage défensif.
        this.emitters = [];
        this.mirrors = [];
        this.sensors = [];
        this.shutters = [];
        this.splitters = [];

        const placeTurretLikeRobot = (emitter, emitterYaw = 0) => {
            if (!this.main?.assets?.turret) {
                return null;
            }

            const pos = emitter.mesh.getAbsolutePosition().clone();
            placeOnMesh(this.main, pos);
            const TURRET_Y_OFFSET = -0.2;
            pos.y += TURRET_Y_OFFSET;

            const turret = createMeshFromAsset(
                this.main.assets['turret'],
                pos,
                'MESH',
                BABYLON.Tools.ToRadians(90),
                false
            );

            turret.scaling = new BABYLON.Vector3(0.9, 0.9, 0.9);
            turret.rotationQuaternion = null;
            turret.rotation.y = emitterYaw;

            let proxyAssigned = false;
            turret.getDescendants().forEach(mesh => {
                try { mesh.isVisible = true; } catch {}
                try {
                    mesh.metadata = mesh.metadata || {};
                    mesh.metadata.laserBlocker = false;
                    mesh.metadata.laserReflector = false;
                    if (!proxyAssigned && mesh.getBoundingInfo) {
                        mesh.isPickable = true;
                        if (emitter.mesh?.metadata?.isInteractable) {
                            mesh.metadata.isInteractable = true;
                            mesh.metadata.onInteract = () => this.toggleLaserControl({ type: 'emitter', id: emitter.id });
                        }
                        proxyAssigned = true;
                    } else {
                        mesh.isPickable = false;
                    }
                } catch {}
            });
            if (!proxyAssigned) {
                try {
                    turret.isPickable = true;
                    turret.metadata = turret.metadata || {};
                    if (emitter.mesh?.metadata?.isInteractable) {
                        turret.metadata.isInteractable = true;
                        turret.metadata.onInteract = () => this.toggleLaserControl({ type: 'emitter', id: emitter.id });
                    }
                } catch {}
            }

            try {
                const haloMat = new BABYLON.StandardMaterial(`${emitter.id}_halo_mat`, scene);
                haloMat.emissiveColor = new BABYLON.Color3(0.12, 0.95, 0.8);
                haloMat.alpha = 0.9;

                const halo = BABYLON.MeshBuilder.CreateTorus(`${emitter.id}_halo`, { diameter: 1.6, thickness: 0.08, tessellation: 32 }, scene);
                halo.parent = turret;
                halo.position = new BABYLON.Vector3(0, 0.18, 0);
                halo.rotation.x = Math.PI / 2;
                halo.material = haloMat;
                halo.isPickable = false;

                emitter.turretHalo = halo;
            } catch {}

            try { emitter.turret = turret; } catch {}
            return turret;
        };

        // Electric puzzle dans la salle 0.
        const c0 = this.roomCenterX(0);
        this.electricPuzzle = new ElectricPuzzle(this.main, new BABYLON.Vector3(c0 + 6.0, 1.1, -1.0));

        const makeEmitter = ({ id, position, color, yaw = 0, pitch = 0, interactive = true, fixed = false }) => {
            const mesh = BABYLON.MeshBuilder.CreateCylinder(id, {
                diameter: 0.8,
                height: 2,
                tessellation: 12,
            }, scene);
            mesh.position = position.clone();

            const emissiveTex = createEmissiveStripTexture(scene, id + '_emissive_dt', {
                size: 512,
                style: 'outline',
                outlineWidthPx: 2,
                outlineGlowPx: 8,
                color,
                intensity: 1.2,
            });
            const mat = createLaserMaterial(id + '_mat', {
                baseColor: new BABYLON.Color3(0.22, 0.22, 0.24),
                emissiveColor: color.scale(2.0),
                emissiveTexture: emissiveTex,
            });
            const baseEmissive = mat.emissiveColor.clone();
            mesh.material = mat;

            try {
                const agg = addStaticPhysics(mesh, 'BOX');
                agg.body.disablePreStep = true;
            } catch {
                // noop
            }

            mesh.metadata = {
                ...(mesh.metadata || {}),
                isInteractable: interactive && !fixed,
                onInteract: interactive && !fixed ? () => this.toggleLaserControl({ type: 'emitter', id }) : undefined,
            };

            const emitter = { id, mesh, yaw, pitch, initYaw: yaw, initPitch: pitch, fixed: !!fixed, baseEmissive, mat, color, enabled: true };
            this.emitters.push(emitter);
            return emitter;
        };

        const makeMirror = ({ id, position, yaw = 0, pitch = 0, interactive = false, color = new BABYLON.Color3(0.2, 0.95, 1.0) }) => {
            const mesh = BABYLON.MeshBuilder.CreatePlane(id, {
                width: 2.4,
                height: 2.4,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE,
            }, scene);
            mesh.position = position.clone();
            mesh.isPickable = true;

            const emissiveTex = createEmissiveStripTexture(scene, id + '_emissive_dt', {
                size: 512,
                style: 'outline',
                outlineWidthPx: 2,
                outlineGlowPx: 8,
                color,
                intensity: 1.2,
            });
            const mat = createLaserMaterial(id + '_mat', {
                baseColor: new BABYLON.Color3(0.10, 0.11, 0.13),
                emissiveColor: color.scale(1.8),
                emissiveTexture: emissiveTex,
            });
            const baseEmissive = mat.emissiveColor.clone();
            mesh.material = mat;

            mesh.metadata = {
                ...(mesh.metadata || {}),
                laserReflector: true,
                isInteractable: !!interactive,
                onInteract: interactive ? () => this.toggleLaserControl({ type: 'mirror', id }) : undefined,
            };

            const mirror = { id, mesh, yaw, pitch, initYaw: yaw, initPitch: pitch, interactive: !!interactive, baseEmissive, mat };
            this.mirrors.push(mirror);
            return mirror;
        };

        const makeSensorCylinder = ({ id, position, colorOff, colorOn, mode = 'bool' }) => {
            const mesh = BABYLON.MeshBuilder.CreateCylinder(id, {
                diameter: 1.6,
                height: 0.5,
                tessellation: 16,
            }, scene);
            mesh.position = position.clone();
            mesh.rotation.x = Math.PI / 2;
            mesh.isPickable = true;

            const emissiveTex = createEmissiveStripTexture(scene, id + '_emissive_dt', {
                size: 512,
                style: 'outline',
                outlineWidthPx: 2,
                outlineGlowPx: 8,
                color: colorOff,
                intensity: 1.0,
            });
            const mat = createLaserMaterial(id + '_mat', {
                baseColor: new BABYLON.Color3(0.14, 0.16, 0.20),
                emissiveColor: colorOff.scale(0.35),
                emissiveTexture: emissiveTex,
            });
            mesh.material = mat;

            mesh.metadata = {
                ...(mesh.metadata || {}),
                laserBlocker: true,
                laserSensorId: id,
            };

            try {
                addStaticPhysics(mesh, 'BOX');
            } catch {
                // noop
            }

            const sensor = { id, mesh, mat, mode, colorOff, colorOn };
            this.sensors.push(sensor);
            this.puzzleState.sensors[id] = false;
            return sensor;
        };

        const emitterPos = new BABYLON.Vector3(c0 - 7, 1.2, -6);
        const mirrorPos = new BABYLON.Vector3(c0 - 1.5, 2.2, -6);
        // Second miroir (proche du joueur, côté "devant" de la salle) pour faire un trajet en 2 rebonds.
        // Placé à z=+6 pour éviter la barrière centrée autour de z=0.
        const mirror2Pos = new BABYLON.Vector3(c0 - 2.8, 2.2, 6);
        // Miroir supplémentaire près du spawn joueur (vu sur la capture),
        // pour offrir un angle de rebond alternatif quand le mur central bloque.
        const mirror3Pos = new BABYLON.Vector3(c0 - 5.4, 2.2, 1.8);
        const sensorPos = new BABYLON.Vector3(c0 + 7, 1.2, 6);

        const e = makeEmitter({
            id: this._comboEmitterId,
            position: emitterPos,
            color: new BABYLON.Color3(1.0, 0.55, 0.15),
            interactive: false,
            fixed: true,
        });

        const comboTurret = placeTurretLikeRobot(e, e.yaw);
        if (comboTurret) {
            try { e.mesh.isVisible = false; } catch {}
        }

        makeMirror({
            id: 'r10_combo_mirror',
            position: mirrorPos,
            yaw: 0,
            pitch: 0,
            interactive: true,
            color: new BABYLON.Color3(0.2, 0.95, 1.0),
        });

        makeMirror({
            id: 'r10_combo_mirror2',
            position: mirror2Pos,
            yaw: 0,
            pitch: 0,
            interactive: true,
            color: new BABYLON.Color3(0.2, 0.95, 1.0),
        });

        makeMirror({
            id: 'r10_combo_mirror3',
            position: mirror3Pos,
            yaw: 0,
            pitch: 0,
            interactive: true,
            color: new BABYLON.Color3(0.2, 0.95, 1.0),
        });

        makeSensorCylinder({
            id: this._comboSensorId,
            position: sensorPos,
            colorOff: new BABYLON.Color3(1.0, 0.55, 0.15),
            colorOn: new BABYLON.Color3(0.12, 0.95, 0.22),
        });

        // Oriente l'émetteur vers le miroir.
        const toMirror = mirrorPos.subtract(emitterPos);
        const yaw = Math.atan2(toMirror.z, toMirror.x);
        const pitch = Math.asin(BABYLON.Scalar.Clamp(toMirror.y / Math.max(0.0001, toMirror.length()), -1, 1));
        e.yaw = yaw;
        e.pitch = pitch;
        e.initYaw = yaw;
        e.initPitch = pitch;

        // Appliquer rotations initiales.
        this.applyLaserVisualRotations();

        // Préparer un pool de beams (VFX).
        this._laserBeamPool = [];
        for (let i = 0; i < 64; i += 1) {
            this._laserBeamPool.push(this.createLaserBeamCross(scene, `laserBeam_${i}`, null, { width: 0.065 }));
        }

        this.updateLaserControlVisuals();

        // Start OFF tant que l'électricité n'est pas résolue.
        this.syncElectricToLaser();
    }

    evaluatePuzzleLogic() {
        const sensorsHit = this.puzzleState?.sensors || {};
        const electricSolved = !!this._electricSolved;

        // Feedback capteurs.
        for (const s of this.sensors || []) {
            if (!s?.mat || !s?.colorOff || !s?.colorOn) continue;

            const t = sensorsHit[s.id] ? 1 : 0;
            const pulse = sensorsHit[s.id] ? (0.95 + 0.05 * Math.sin((this._now || 0) * 0.01 + (s.id.charCodeAt(1) || 0))) : 1;
            const off = s.colorOff.scale(0.35);
            const on = s.colorOn.scale(2.0);
            s.mat.emissiveColor = BABYLON.Color3.Lerp(off, on, BABYLON.Scalar.Clamp(t, 0, 1)).scale(pulse);
        }

        const openDoor = (doorIndex, condition) => {
            const door = this.doors?.[doorIndex];
            if (!door) return;

            if (condition) {
                door.openUntil = (this._now || 0) + (this.DOOR_CLOSE_DELAY_S || 0);
            }
            door.targetOpen = (this._now || 0) < (door.openUntil || 0);
        };

        openDoor(0, electricSolved && !!sensorsHit[this._comboSensorId]);
    }
}
