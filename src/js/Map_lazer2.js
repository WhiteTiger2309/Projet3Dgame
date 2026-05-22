import * as BABYLON from '@babylonjs/core'

import { createDiegeticTeleportMarker, createMapChangeGate, addStaticPhysics, createMeshFromAsset, placeOnMesh } from './utils/utils.js';
import { createEmissiveStripTexture, createPbrPanelMaterial } from './utils/materials.js';
import { MapLazer } from './Map_lazer.js';
import { MapLazer3 } from './Map_lazer3.js';

export class MapLazer2 extends MapLazer {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION);

        // Mini-map: 2 salles (puzzle + sortie)
        this.ROOM_COUNT = 2;
        this.CORRIDOR_LENGTH = this.ROOM_COUNT * this.ROOM_LENGTH;
        this.ROOM0_CENTER_X = (-this.CORRIDOR_LENGTH / 2) + (this.ROOM_LENGTH / 2);

        // Porte: sur une mini-map, on laisse plus de temps pour traverser.
        this.DOOR_CLOSE_DELAY_S = 4.0;

        // Spawn en salle puzzle
        this.player.respawnPos = new BABYLON.Vector3(this.ROOM0_CENTER_X - 6, 2, 0);
        this.player.respawnRotation = 1.57;
        this.player.resetPos();
    }

    createMap() {
        super.createMap();

        // Gate vers MapLazer3 dans la salle de sortie.
        // On le place juste derrière la porte (côté salle 2).
        const gatePos = new BABYLON.Vector3(this.roomBoundaryX(0) + 2.4, 0, 0);
        createMapChangeGate(this.main, MapLazer3, gatePos, undefined, 90);

        createDiegeticTeleportMarker(this.scene, gatePos, 'lazer2');
    }

    createLightingAccent(scene) {
        const hemi = new BABYLON.HemisphericLight('hemiFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.34;

        const dir = new BABYLON.DirectionalLight('dirMain', new BABYLON.Vector3(-0.35, -1, 0.2), scene);
        dir.intensity = 0.75;
        dir.position = new BABYLON.Vector3(20, 45, -12);

        const lightXs = [this.roomCenterX(0), this.roomCenterX(1)];
        const colors = [
            new BABYLON.Color3(0.2, 0.7, 1.0),
            new BABYLON.Color3(0.8, 0.25, 1.0),
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

        // Salle 2: un pilier pour rendre la réflexion plus intéressante.
        // IMPORTANT: ne pas le mettre au même endroit que le miroir (sinon il bloque le rayon).
        const obstacleMat = new BABYLON.StandardMaterial('laserCourseObstacleMat_r2', scene);
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

        makePillar('r2_pillar', this.roomCenterX(0) , -1, 1.8, 4.2, 1.8);
    }

    createHintPanels(scene) {
        const z = -(this.ROOM_DEPTH / 2) + 10.2;
        const xOffset = -(this.ROOM_LENGTH / 2) - 1.5;
        const pos = new BABYLON.Vector3(this.roomCenterX(1) + xOffset, 8.4, z);
        this.createHintPanel('hint_room_2', pos, 'SALLE 2 — Miroir fixe: rebondis sur le miroir pour toucher le capteur.');
    }

    createLaserSystem(scene) {
        // Tous les éléments laser pour la salle miroir fixe.
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
                    if (!proxyAssigned && mesh.getBoundingInfo) {
                        mesh.isPickable = true;
                        mesh.metadata = mesh.metadata || {};
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
            const mat = createPbrPanelMaterial(scene, id + '_mat', {
                baseColor: new BABYLON.Color3(0.10, 0.11, 0.13),
                metallic: 0.05,
                roughness: 0.65,
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

        // --- Placement salle (miroir fixe) ---
        // On conserve les noms/variables de la Salle 2, mais dans cette mini-map la salle puzzle est roomIndex=0.
        const c1 = this.roomCenterX(0);

        // Salle 2 (miroir fixe)
        const r2EmitterPos = new BABYLON.Vector3(c1 - 7, 1.2, -6);
        const r2MirrorPos = new BABYLON.Vector3(c1, 1.2, 2.0);
        const r2SensorPos = new BABYLON.Vector3(c1 + 7, 1.2, 6);

        // Miroir non interactif: solvable sans pitch.
        // On calcule un yaw qui renvoie (quand on vise le centre du miroir) vers le capteur.
        const r2In = r2MirrorPos.subtract(r2EmitterPos).normalize();
        const r2Out = r2SensorPos.subtract(r2MirrorPos).normalize();
        let r2Yaw = 0;
        const r2N = r2In.subtract(r2Out);
        if (r2N.lengthSquared() > 1e-6) {
            const nn = r2N.normalize();
            r2Yaw = Math.atan2(nn.x, nn.z);
        }

        const e2 = makeEmitter({ id: 'r2_emitter', position: r2EmitterPos, color: new BABYLON.Color3(0.9, 0.15, 1.0) });
        const turret2 = placeTurretLikeRobot(e2, e2.yaw);
        if (turret2) {
            try { e2.mesh.isVisible = false; } catch {}
        }
        makeMirror({ id: 'r2_mirror', position: r2MirrorPos, yaw: r2Yaw, pitch: 0, interactive: false, color: new BABYLON.Color3(0.2, 0.95, 1.0) });
        makeSensorCylinder({ id: 'r2_sensor', position: r2SensorPos, colorOff: new BABYLON.Color3(0.2, 0.95, 1.0), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

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
            const off = s.colorOff.scale(0.35);
            const on = s.colorOn.scale(2.0);
            s.mat.emissiveColor = BABYLON.Color3.Lerp(off, on, BABYLON.Scalar.Clamp(t, 0, 1));
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

        openDoor(0, !!sensorsHit.r2_sensor);
    }
}
