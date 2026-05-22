import * as BABYLON from '@babylonjs/core'

import { addStaticPhysics, createDiegeticTeleportMarker, createMapChangeGate, createMeshFromAsset, placeOnMesh } from './utils/utils.js';
import { createEmissiveStripTexture, createPbrPanelMaterial } from './utils/materials.js';
import { MapLazer } from './Map_lazer.js';
import { MapLazer4 } from './Map_lazer4.js';

export class MapLazer3 extends MapLazer {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION);

        // Mini-map: 2 salles (puzzle + sortie)
        this.ROOM_COUNT = 2;
        this.CORRIDOR_LENGTH = this.ROOM_COUNT * this.ROOM_LENGTH;
        this.ROOM0_CENTER_X = (-this.CORRIDOR_LENGTH / 2) + (this.ROOM_LENGTH / 2);

        // Spawn en salle puzzle
        this.player.respawnPos = new BABYLON.Vector3(this.ROOM0_CENTER_X - 6, 2, 0);
        this.player.respawnRotation = 1.57;
        this.player.resetPos();
    }

    createMap() {
        super.createMap();

        // Gate vers MapLazer4 dans la salle de sortie.
        // On le place juste derrière la porte (côté salle 2).
        const gatePos = new BABYLON.Vector3(this.roomBoundaryX(0) + 2.4, 0, 0);
        createMapChangeGate(this.main, MapLazer4, gatePos, undefined, 90);

        createDiegeticTeleportMarker(this.scene, gatePos, 'lazer3');
    }

    createLightingAccent(scene) {
        const hemi = new BABYLON.HemisphericLight('hemiFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.34;

        const dir = new BABYLON.DirectionalLight('dirMain', new BABYLON.Vector3(-0.35, -1, 0.2), scene);
        dir.intensity = 0.75;
        dir.position = new BABYLON.Vector3(20, 45, -12);

        const lightXs = [this.roomCenterX(0), this.roomCenterX(1)];
        const colors = [
            new BABYLON.Color3(1.0, 0.5, 0.25),
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

        // Salle 6: piliers autour du prisme.
        const obstacleMat = new BABYLON.StandardMaterial('laserCourseObstacleMat_r6', scene);
        obstacleMat.diffuseColor = new BABYLON.Color3(0.18, 0.19, 0.22);
        obstacleMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.04);
        obstacleMat.specularColor = BABYLON.Color3.Black();

        const makePillar = (name, x, z, w = 1.6, h = 4.0, d = 1.6) => {
            const p = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
            p.position = new BABYLON.Vector3(x, h / 2, z);
            p.material = obstacleMat;
            p.metadata = { ...(p.metadata || {}), laserBlocker: true };
            addStaticPhysics(p, 'BOX');
            return p;
        };

        const c5 = this.roomCenterX(0);
        makePillar('r6_pillar_a', c5 - 2.8, 4.5, 1.4, 3.2, 1.4);
        makePillar('r6_pillar_b', c5 - 2.8, -4.5, 1.4, 3.2, 1.4);
    }

    createHintPanels(scene) {
        const z = -(this.ROOM_DEPTH / 2) + 10.2;
        const xOffset = -(this.ROOM_LENGTH / 2) - 1.5;
        const pos = new BABYLON.Vector3(this.roomCenterX(1) + xOffset, 8.4, z);
        this.createHintPanel(
            'hint_room_6',
            pos,
            'SALLE 6 — Splitter/prisme: le faisceau se sépare, il faut alimenter 2 capteurs (E sur le prisme pour l\'orienter).'
        );
    }

    createLaserSystem(scene) {
        // Tous les éléments laser pour la salle splitter/prisme.
        this.ensureLaserBeamShaders();

        // Nettoyage défensif si recréation.
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
            const mat = createPbrPanelMaterial(scene, id + '_mat', {
                baseColor: new BABYLON.Color3(0.22, 0.22, 0.24),
                metallic: 0.12,
                roughness: 0.65,
                emissiveColor: color.scale(2.0),
                emissiveTexture: emissiveTex,
            });
            const baseEmissive = mat.emissiveColor.clone();
            mesh.material = mat;

            // Physique statique (décor), mais ne bloque pas le laser.
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

            const emitter = { id, mesh, yaw, pitch, initYaw: yaw, initPitch: pitch, fixed: !!fixed, baseEmissive, mat, color };
            this.emitters.push(emitter);
            return emitter;
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
            const mat = createPbrPanelMaterial(scene, id + '_mat', {
                baseColor: new BABYLON.Color3(0.14, 0.16, 0.20),
                metallic: 0.08,
                roughness: 0.85,
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

        const makeSplitter = ({ id, position, yaw = 0, splitDirsLocal, interactive = false }) => {
            const mesh = BABYLON.MeshBuilder.CreateBox(id, { width: 1.2, height: 1.2, depth: 1.2 }, scene);
            mesh.position = position.clone();
            mesh.rotation.y = yaw;
            mesh.isPickable = true;

            const mat = new BABYLON.StandardMaterial(id + '_mat', scene);
            mat.diffuseColor = new BABYLON.Color3(0.12, 0.18, 0.25);
            mat.emissiveColor = new BABYLON.Color3(0.05, 0.15, 0.25);
            const baseEmissive = mat.emissiveColor.clone();
            mesh.material = mat;

            mesh.metadata = {
                ...(mesh.metadata || {}),
                laserSplitter: true,
                laserBlocker: true,
                splitDirsLocal,
                isInteractable: !!interactive,
                onInteract: interactive ? () => this.toggleLaserControl({ type: 'splitter', id }) : undefined,
            };

            try {
                addStaticPhysics(mesh, 'BOX');
            } catch {
                // noop
            }

            const splitter = { id, mesh, splitDirsLocal, yaw, initYaw: yaw, interactive: !!interactive, mat, baseEmissive };
            this.splitters.push(splitter);
            return splitter;
        };

        // --- Placement salle (splitter) ---
        // On conserve les noms/variables de la Salle 6, mais dans cette mini-map la salle puzzle est roomIndex=0.
        const c5 = this.roomCenterX(0);

        // Salle 6 (splitter)
        const r6EmitterPos = new BABYLON.Vector3(c5 - 7.4, 1.2, 0);
        const r6PrismPos = new BABYLON.Vector3(c5 - 4.0, 1.6, 0);
        const r6SensorAPos = new BABYLON.Vector3(c5 + 7, 1.2, 6);
        const r6SensorBPos = new BABYLON.Vector3(c5 + 7, 1.2, -6);

        // Calibre les 2 directions de split pour aller naturellement vers les deux capteurs.
        // (La rotation du prisme est ensuite possible via interaction.)
        const r6DirA = r6SensorAPos.subtract(r6PrismPos).normalize();
        const r6DirB = r6SensorBPos.subtract(r6PrismPos).normalize();

        makeEmitter({
            id: 'r6_emitter',
            position: r6EmitterPos,
            color: new BABYLON.Color3(1.0, 0.25, 0.8),
            yaw: 0.42,
        });
        const e6 = this.emitters.find(x => x.id === 'r6_emitter');
        if (e6) {
            const turret6 = placeTurretLikeRobot(e6, e6.yaw);
            if (turret6) {
                try { e6.mesh.isVisible = false; } catch {}
            }
        }
        makeSplitter({
            id: 'r6_prism',
            position: r6PrismPos,
            yaw: 0,
            splitDirsLocal: [r6DirA, r6DirB],
            interactive: true,
        });
        makeSensorCylinder({ id: 'r6_sensor_a', position: r6SensorAPos, colorOff: new BABYLON.Color3(1.0, 0.25, 0.8), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });
        makeSensorCylinder({ id: 'r6_sensor_b', position: r6SensorBPos, colorOff: new BABYLON.Color3(1.0, 0.25, 0.8), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

        // Appliquer rotations initiales.
        this.applyLaserVisualRotations();

        // Préparer un pool de beams (VFX). On active/désactive selon le nombre de segments.
        this._laserBeamPool = [];
        for (let i = 0; i < 64; i += 1) {
            this._laserBeamPool.push(this.createLaserBeamCross(scene, `laserBeam_${i}`, null, { width: 0.065 }));
        }

        this.updateLaserControlVisuals();
    }

    evaluatePuzzleLogic() {
        const sensorsHit = this.puzzleState?.sensors || {};

        // Feedback capteurs.
        for (const s of this.sensors || []) {
            if (!s?.mat || !s?.colorOff || !s?.colorOn) continue;

            const t = sensorsHit[s.id] ? 1 : 0;
            const pulse = sensorsHit[s.id] ? (0.95 + 0.05 * Math.sin((this._now || 0) * 0.01 + (s.id.charCodeAt(1) || 0))) : 1;
            const off = s.colorOff.scale(0.35);
            const on = s.colorOn.scale(2.0);
            s.mat.emissiveColor = BABYLON.Color3.Lerp(off, on, BABYLON.Scalar.Clamp(t, 0, 1)).scale(pulse);
        }

        // Portes: maintien avec fermeture retardée.
        const openDoor = (doorIndex, condition) => {
            const door = this.doors?.[doorIndex];
            if (!door) return;

            if (condition) {
                door.openUntil = (this._now || 0) + (this.DOOR_CLOSE_DELAY_S || 0);
            }
            door.targetOpen = (this._now || 0) < (door.openUntil || 0);
        };

        openDoor(0, !!sensorsHit.r6_sensor_a && !!sensorsHit.r6_sensor_b);
    }
}
