import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics } from './utils/utils.js';
import { createSciFiPanelTexture, createSciFiEmissiveLinesTexture, createPbrPanelMaterial, createEmissiveStripTexture } from './utils/materials.js';

export class MapLazer extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        // Progression linéaire: 9 salles laser.
        const ROOM_COUNT = 9;
        const ROOM_LENGTH = 18;
        const ROOM_DEPTH = 24;
        const WALL_HEIGHT = 6.5;
        const WALL_THICKNESS = 1.2;
        const DOOR_GAP_DEPTH = 8;

        // Portes: à maintenir, mais avec un petit délai avant fermeture.
        const DOOR_CLOSE_DELAY_S = 1.35;

        const CORRIDOR_LENGTH = ROOM_COUNT * ROOM_LENGTH;
        const ROOM0_CENTER_X = (-CORRIDOR_LENGTH / 2) + (ROOM_LENGTH / 2);

        // Spawn en Salle 1.
        PLAYER_SPAWN_POS = new BABYLON.Vector3(ROOM0_CENTER_X - 6, 2, 0);
        PLAYER_SPAWN_ROTATION = 1.57;

        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main);

        this.ROOM_COUNT = ROOM_COUNT;
        this.ROOM_LENGTH = ROOM_LENGTH;
        this.ROOM_DEPTH = ROOM_DEPTH;
        this.WALL_HEIGHT = WALL_HEIGHT;
        this.WALL_THICKNESS = WALL_THICKNESS;
        this.DOOR_GAP_DEPTH = DOOR_GAP_DEPTH;
        this.DOOR_CLOSE_DELAY_S = DOOR_CLOSE_DELAY_S;
        this.CORRIDOR_LENGTH = CORRIDOR_LENGTH;
        this.ROOM0_CENTER_X = ROOM0_CENTER_X;

        this.havokPlugin = main.havokPlugin;

        this._now = 0;

        // Etat de puzzle (capteurs + charges).
        this.puzzleState = {
            sensors: {},
            charge: {
                room5: 0,
                room8: 0,
            },
        };

        // Contrôle laser (E pour sélectionner, IJKL/flèches pour orienter, T/Echap pour quitter).
        this.laserControl = {
            active: null, // { type: 'emitter'|'mirror', id: string }
            yawSpeed: 1.1,
            pitchSpeed: 0.8,
        };

        this.emitters = []; // { id, mesh, yaw, pitch, fixed, baseEmissive, mat, color }
        this.mirrors = []; // { id, mesh, yaw, pitch, interactive, baseEmissive, mat }
        this.sensors = []; // { id, mesh, mat, mode, maxAngleCos?, roomIndex? }
        this.shutters = []; // { id, mesh, period, duty, phase }
        this.splitters = []; // { id, mesh, splitDirsLocal: [Vector3, Vector3] }

        // Portes entre salles.
        this.doors = []; // index 0..7 => door between room i and i+1

        // Laser VFX pooling.
        this._laserTime = 0;
        this._laserBeamPool = []; // array of {root,p1,p2}
        this._laserBeamMats = new Map(); // key = color string

        // Edge detection locale (ne dépend pas de player.input.justPressed, vidé avant la map).
        this._keyPrev = {};
        this._keyJustPressed = {};
    }

    createMap() {
        this.createGround(this.scene);
        this.createSkyAboveGround(this.scene);
        this.createBoundaryWalls(this.scene);
        this.createLightingAccent(this.scene);

        // Couloir 9 salles + portes + obstacles.
        this.createPuzzleRooms(this.scene);

        // Emitters / capteurs / miroirs / prismes / shutters.
        this.createLaserSystem(this.scene);

        // UX: panneaux d'aide par salle.
        this.createHintPanels(this.scene);
    }

    changeSceneBackground(scene) {
        scene.ambientColor = new BABYLON.Color3(0.20, 0.20, 0.24);
        scene.clearColor = new BABYLON.Color4(0.01, 0.02, 0.04, 1.0);
    }

    mapBeforeRenderUpdate() {
        this._now = (this._now || 0) + (this.deltaTime || 0);

        this.updateKeyEdges();

        if (this.handleManualReset()) return;

        this.updateLaserControls();
        this.updateRoomAnimations();
        this.updateLaserSystem();
        this.evaluatePuzzleLogic();
        this.updateDoors();
    }

    updateKeyEdges() {
        const inputMap = this.player?.input?.inputMap || {};
        const prev = this._keyPrev || (this._keyPrev = {});
        const just = {};

        for (const k of ['KeyT', 'Escape', 'KeyR']) {
            const cur = !!inputMap[k];
            const was = !!prev[k];
            if (cur && !was) just[k] = true;
            prev[k] = cur;
        }

        this._keyJustPressed = just;
    }

    roomCenterX(roomIndex) {
        return this.ROOM0_CENTER_X + (roomIndex * this.ROOM_LENGTH);
    }

    roomBoundaryX(roomIndex) {
        return this.roomCenterX(roomIndex) + (this.ROOM_LENGTH / 2);
    }

    quaternionFromUpToDir(dir) {
        const from = BABYLON.Vector3.Up();
        const to = dir.normalize();
        const dot = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(from, to), -1, 1);

        if (dot > 0.999999) {
            return BABYLON.Quaternion.Identity();
        }
        if (dot < -0.999999) {
            // 180° flip
            return BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI);
        }

        const axis = BABYLON.Vector3.Cross(from, to);
        axis.normalize();
        const angle = Math.acos(dot);
        return BABYLON.Quaternion.RotationAxis(axis, angle);
    }

    ensureLaserBeamShaders() {
        if (BABYLON.Effect.ShadersStore["laserBeamVertexShader"] && BABYLON.Effect.ShadersStore["laserBeamFragmentShader"]) {
            return;
        }

        BABYLON.Effect.ShadersStore["laserBeamVertexShader"] = `
            precision highp float;
            attribute vec3 position;
            attribute vec2 uv;

            uniform mat4 worldViewProjection;

            varying vec2 vUV;

            void main(void) {
                vUV = uv;
                gl_Position = worldViewProjection * vec4(position, 1.0);
            }
        `;

        BABYLON.Effect.ShadersStore["laserBeamFragmentShader"] = `
            precision highp float;

            varying vec2 vUV;

            uniform float time;
            uniform float beamLength;
            uniform float intensity;
            uniform vec3 beamColor;

            void main(void) {
                // Thin core across the width (uv.x)
                float x = abs(vUV.x - 0.5) * 2.0;
                float core = smoothstep(1.0, 0.0, x);
                core = pow(core, 3.0);

                // Animated pulses along the beam (uv.y)
                float worldFreq = max(0.5, beamLength * 0.6);
                float t = vUV.y * worldFreq - time * 6.5;
                float pulse = 0.55 + 0.45 * sin(t * 6.2831853);

                // Slight edge falloff to keep it very thin
                float alpha = core * (0.65 + 0.35 * pulse);
                alpha *= intensity;

                vec3 col = beamColor * alpha;
                gl_FragColor = vec4(col, alpha);
            }
        `;
    }

    createLaserBeamCross(scene, name, material, { width = 0.06 } = {}) {
        const root = new BABYLON.TransformNode(name + "_root", scene);
        root.rotationQuaternion = BABYLON.Quaternion.Identity();

        const p1 = BABYLON.MeshBuilder.CreatePlane(name + "_p1", {
            width: 1,
            height: 1,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        }, scene);
        p1.isPickable = false;
        p1.parent = root;
        p1.material = material;
        p1.scaling.x = width;

        const p2 = p1.clone(name + "_p2");
        p2.isPickable = false;
        p2.parent = root;
        p2.rotation.y = Math.PI / 2;
        p2.scaling.x = width;

        root.setEnabled(false);

        return { root, p1, p2 };
    }

    setLaserBeamSegment(beam, material, start, end) {
        const delta = end.subtract(start);
        const length = delta.length();
        if (!isFinite(length) || length < 0.05) {
            beam.root.setEnabled(false);
            return;
        }

        const dir = delta.scale(1 / length);
        const mid = start.add(delta.scale(0.5));

        beam.root.setEnabled(true);
        beam.root.position.copyFrom(mid);
        beam.root.rotationQuaternion = this.quaternionFromUpToDir(dir);
        beam.p1.scaling.y = length;
        beam.p2.scaling.y = length;

        // NB: en multi-segments, plusieurs beams peuvent partager le même matériau.
        // On évite donc de mettre à jour un uniform par segment ici.
    }

    createGround(scene) {
        const groundWidth = this.CORRIDOR_LENGTH;
        const groundDepth = this.ROOM_DEPTH;

        const ground = BABYLON.MeshBuilder.CreateGround('ground', {
            width: groundWidth,
            height: groundDepth,
            subdivisions: 2,
        }, scene);

        // Asphalt ground (matte) for readability.
        const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
        const asphalt = new BABYLON.Texture('/assets/terrain/asphalt_01.jpg', scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        asphalt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        asphalt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        asphalt.uScale = Math.max(6, groundWidth / 16);
        asphalt.vScale = Math.max(2, groundDepth / 10);
        asphalt.gammaSpace = true;
        asphalt.anisotropicFilteringLevel = 8;
        groundMat.diffuseTexture = asphalt;
        groundMat.specularColor = BABYLON.Color3.Black();
        ground.material = groundMat;

        ground.metadata = { ...(ground.metadata || {}), laserBlocker: true };
        addStaticPhysics(ground, 'BOX');

        // Thick fallback collider prevents character tunneling on thin surfaces.
        const groundCollider = BABYLON.MeshBuilder.CreateBox('groundCollider', {
            width: groundWidth,
            depth: groundDepth,
            height: 8,
        }, scene);
        groundCollider.position.y = -4;
        groundCollider.isVisible = false;
        groundCollider.metadata = { ...(groundCollider.metadata || {}), laserBlocker: true };
        addStaticPhysics(groundCollider, 'BOX');
    }

    createSkyAboveGround(scene) {
        const sky = BABYLON.MeshBuilder.CreateSphere('spaceSkyAbove', {
            diameter: 900,
            segments: 48,
            slice: 0.5,
            sideOrientation: BABYLON.Mesh.BACKSIDE,
        }, scene);
        sky.position = new BABYLON.Vector3(0, -20, 0);
        sky.isPickable = false;

        const skyMat = new BABYLON.StandardMaterial('spaceSkyAboveMat', scene);
        skyMat.diffuseTexture = new BABYLON.Texture('/assets/space/space1.png', scene);
        skyMat.emissiveTexture = skyMat.diffuseTexture;
        skyMat.disableLighting = true;
        skyMat.backFaceCulling = false;
        skyMat.fogEnabled = false;
        sky.material = skyMat;
    }

    createBoundaryWalls(scene) {
        const wallPanelTex = createSciFiPanelTexture(scene, 'wallPanel_dt', {
            size: 512,
            grid: 96,
            lineAlpha: 0.22,
            microNoiseAlpha: 0.05,
        });

        const wallNeon = createSciFiEmissiveLinesTexture(scene, 'wallNeon_dt', {
            size: 512,
            grid: 96,
            lineAlpha: 0.9,
            boltAlpha: 0.75,
            color: new BABYLON.Color3(0.0, 0.95, 1.0),
        });
        const wallMat = createPbrPanelMaterial(scene, 'wallMat', {
            baseColor: new BABYLON.Color3(0.16, 0.17, 0.20),
            texture: wallPanelTex,
            textureUScale: 1.2,
            textureVScale: 1,
            metallic: 0.05,
            roughness: 0.9,
            emissiveColor: new BABYLON.Color3(0.0, 0.95, 1.0).scale(0.22),
            emissiveTexture: wallNeon,
        });

        const wallHeight = this.WALL_HEIGHT;
        const y = wallHeight / 2;
        const halfLen = this.CORRIDOR_LENGTH / 2;
        const halfD = this.ROOM_DEPTH / 2;
        const thickness = this.WALL_THICKNESS;

        const makeWall = (name, width, height, depth, position) => {
            const wall = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
            wall.position = position;
            wall.material = wallMat;
            wall.metadata = { ...(wall.metadata || {}), laserBlocker: true };
            addStaticPhysics(wall, 'BOX');
            return wall;
        };

        // Coque extérieure.
        makeWall('northWall', this.CORRIDOR_LENGTH, wallHeight, thickness, new BABYLON.Vector3(0, y, halfD));
        makeWall('southWall', this.CORRIDOR_LENGTH, wallHeight, thickness, new BABYLON.Vector3(0, y, -halfD));
        makeWall('westWall', thickness, wallHeight, this.ROOM_DEPTH, new BABYLON.Vector3(-halfLen, y, 0));
        makeWall('eastWall', thickness, wallHeight, this.ROOM_DEPTH, new BABYLON.Vector3(halfLen, y, 0));

        // Cloisons entre salles, avec ouverture centrale (gap) pour les portes.
        const gapDepth = this.DOOR_GAP_DEPTH;
        const segmentDepth = (this.ROOM_DEPTH - gapDepth) / 2;
        const zN = (gapDepth / 2) + (segmentDepth / 2);
        const zS = -zN;

        for (let i = 0; i < this.ROOM_COUNT - 1; i += 1) {
            const x = this.roomBoundaryX(i);
            makeWall(`partition_${i}_north`, thickness, wallHeight, segmentDepth, new BABYLON.Vector3(x, y, zN));
            makeWall(`partition_${i}_south`, thickness, wallHeight, segmentDepth, new BABYLON.Vector3(x, y, zS));
        }
    }

    createLightingAccent(scene) {
        const hemi = new BABYLON.HemisphericLight('hemiFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.34;

        const dir = new BABYLON.DirectionalLight('dirMain', new BABYLON.Vector3(-0.35, -1, 0.2), scene);
        dir.intensity = 0.75;
        dir.position = new BABYLON.Vector3(20, 45, -12);

        // Quelques points de lumière répartis sur le couloir.
        const lightXs = [this.roomCenterX(0), this.roomCenterX(3), this.roomCenterX(6), this.roomCenterX(8)];
        const colors = [
            new BABYLON.Color3(0.2, 0.7, 1.0),
            new BABYLON.Color3(0.3, 1.0, 0.6),
            new BABYLON.Color3(1.0, 0.5, 0.25),
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

        // Quelques obstacles simples pour rendre certaines salles moins "vides".
        const obstacleMat = new BABYLON.StandardMaterial('laserCourseObstacleMat', scene);
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

        // Salle 2: un pilier pour rendre la réflexion plus intéressante.
        // IMPORTANT: ne pas le mettre au même endroit que le miroir (sinon il bloque le rayon).
        makePillar('r2_pillar', this.roomCenterX(1) + 2.2, -2.2, 1.8, 4.2, 1.8);

        // Salle 6: piliers autour du prisme.
        makePillar('r6_pillar_a', this.roomCenterX(5) - 2.8, 4.5, 1.4, 3.2, 1.4);
        makePillar('r6_pillar_b', this.roomCenterX(5) - 2.8, -4.5, 1.4, 3.2, 1.4);

        // Salle 7: obstacle central.
        makePillar('r7_pillar', this.roomCenterX(6) + 1.5, 0, 1.8, 4.0, 2.6);
    }

    createInteractiveObjects(scene) {
        this.heavyCube = this.createPickupCube(
            'heavyCube',
            new BABYLON.Vector3(-42, 1.2, -6),
            1.7,
            130,
            new BABYLON.Color3(0.55, 0.55, 0.65),
            'heavy'
        );

        this.conductiveCube = this.createPickupCube(
            'conductiveCube',
            new BABYLON.Vector3(8, 1.2, 6),
            1.2,
            45,
            new BABYLON.Color3(0.2, 0.75, 1.0),
            'conductive'
        );

        this.cubeSpawns = {
            heavy: this.heavyCube.position.clone(),
            conductive: this.conductiveCube.position.clone(),
        };
    }

    createPuzzleDevices(scene) {
        // Chamber A: OR logic (button OR heavy plate)
        createButton(
            new BABYLON.Vector3(-56, 0.12, 6),
            () => {
                this.puzzleState.floorButton = true;
            },
            () => {
                this.puzzleState.floorButton = false;
            },
            scene
        );

        this.createPressurePlate(
            'heavyPlate',
            new BABYLON.Vector3(-34, 0.12, -6),
            new BABYLON.Color3(0.8, 0.8, 0.2)
        );

        // Chamber B: conductive socket + laser sensor (AND logic)
        this.createSocketTrigger(
            'conductiveSocket',
            new BABYLON.Vector3(14, 0.25, -8),
            new BABYLON.Color3(0.2, 0.8, 1.0)
        );

        // Plateforme qui donne accès au miroir (avant la porte B).
        this.createMovingPlatform(scene);
        this.createPlatformReceiver(scene);
        this.createMirrorBalcony(scene);

        this.createLaserSystem(scene);
        this.createChamberBIndicators(scene);

        // Force field blocks final chamber until doorB is solved
        this.setForceFieldEnabled(true);

        // Jump pad as alternative traversal mechanic (déplacé pour ne pas bypass le miroir)
        this.createJumpPad(scene, new BABYLON.Vector3(62, 0.12, 8));
    }

    createHintPanels(scene) {
        const z = -(this.ROOM_DEPTH / 2) + 1.2;
        const xOffset = -(this.ROOM_LENGTH / 2) + 2.6;

        const hints = [
            'SALLE 1 (TUTO) — Vise le CAPTEUR pour ouvrir la porte. E: interagir, IJKL/flèches: orienter, T/Echap: quitter, R: reset.',
            'SALLE 2 — Miroir fixe: rebondis sur le miroir pour toucher le capteur.',
            'SALLE 3 — Miroir interactif: E sur le miroir puis IJKL/flèches pour viser le capteur (l\'émetteur est fixe).',
            'SALLE 4 — Shutter (timing): le laser passe seulement quand le volet est ouvert.',
            'SALLE 5 — Capteur à charge: maintiens le laser dessus pour remplir la jauge.',
            'SALLE 6 — Splitter/prisme: le faisceau se sépare, il faut alimenter 2 capteurs (E sur le prisme pour l\'orienter).',
            'SALLE 7 — Capteur directionnel: il faut arriver du bon angle (E sur le miroir pour l\'orienter, puis vise le capteur DIR).',
            'SALLE 8 — Cible mobile: touche-la assez longtemps pour ouvrir la porte.',
            'SALLE 9 — Miroir portable: il ne réfléchit que posé sur le support (snap). En main: IJKL/flèches pour l\'orienter.',
        ];

        for (let i = 0; i < hints.length; i += 1) {
            const pos = new BABYLON.Vector3(this.roomCenterX(i) + xOffset, 3.4, z);
            this.createHintPanel(`hint_room_${i + 1}`, pos, hints[i]);
        }
    }

    createSlidingDoor(name, position, sizeVec3) {
        const door = BABYLON.MeshBuilder.CreateBox(name, {
            width: sizeVec3.x,
            height: sizeVec3.y,
            depth: sizeVec3.z,
        }, this.scene);

        const doorTex = createSciFiPanelTexture(this.scene, name + '_panel_dt', {
            size: 512,
            grid: 128,
            lineAlpha: 0.24,
            microNoiseAlpha: 0.06,
        });
        const doorEmissive = createEmissiveStripTexture(this.scene, name + '_emissive_dt', {
            size: 1024,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 10,
            color: new BABYLON.Color3(0.0, 0.95, 1.0),
            intensity: 1.25,
        });
        const mat = createPbrPanelMaterial(this.scene, name + '_mat', {
            baseColor: new BABYLON.Color3(0.28, 0.30, 0.36),
            texture: doorTex,
            textureUScale: 1,
            textureVScale: 1,
            metallic: 0.08,
            roughness: 0.75,
            emissiveColor: new BABYLON.Color3(0.0, 0.9, 1.0).scale(2.25),
            emissiveTexture: doorEmissive,
        });
        door.material = mat;
        door.position = position.clone();
        door.metadata = { ...(door.metadata || {}), laserBlocker: true };

        // ANIMATED (Havok): permet de déplacer la porte proprement (collisions à jour).
        const agg = new BABYLON.PhysicsAggregate(
            door,
            BABYLON.PhysicsShapeType.BOX,
            { mass: 0, friction: 0.7, restitution: 0.1 },
            this.scene
        );
        agg.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
        agg.body.disablePreStep = false;

        const closedPos = position.clone();
        const openPos = position.clone().add(new BABYLON.Vector3(0, sizeVec3.y + 0.6, 0));

        return {
            mesh: door,
            aggregate: agg,
            closedPos,
            openPos,
            isOpen: false,
            targetOpen: false,
            currentPos: closedPos.clone(),
            openUntil: 0,
        };
    }

    setDoorState(doorObj, shouldOpen) {
        doorObj.targetOpen = !!shouldOpen;
        doorObj.isOpen = !!shouldOpen;
    }

    updateDoors() {
        if (!this.doors?.length) return;

        const dt = this.deltaTime || 0;
        const alpha = BABYLON.Scalar.Clamp(dt * 10, 0, 1);
        const q = BABYLON.Quaternion.Identity();

        for (const door of this.doors) {
            const target = door.targetOpen ? door.openPos : door.closedPos;
            door.currentPos = BABYLON.Vector3.Lerp(door.currentPos, target, alpha);
            door.mesh.position.copyFrom(door.currentPos);

            // Sync physique
            try {
                door.aggregate?.body?.setTargetTransform(door.currentPos, door.mesh.rotationQuaternion || q);
            } catch {
                // noop
            }
        }
    }

    createPickupCube(name, position, size, mass, color, cubeType) {
        const cube = BABYLON.MeshBuilder.CreateBox(name, {
            width: size,
            height: size,
            depth: size,
        }, this.scene);
        cube.position = position.clone();

        const cubeTex = createSciFiPanelTexture(this.scene, name + '_panel_dt', {
            size: 512,
            grid: 128,
            lineAlpha: 0.2,
            microNoiseAlpha: 0.05,
        });

        // Keep materials visually distinct per cube type (heavy vs conductive).
        const metallic = cubeType === 'conductive' ? 0.12 : 0.06;
        const roughness = cubeType === 'conductive' ? 0.65 : 0.85;
        const emissive = cubeType === 'conductive' ? color.scale(0.08) : BABYLON.Color3.Black();

        const mat = createPbrPanelMaterial(this.scene, name + '_mat', {
            baseColor: color,
            emissiveColor: emissive,
            texture: cubeTex,
            metallic,
            roughness,
        });
        cube.material = mat;

        const agg = new BABYLON.PhysicsAggregate(
            cube,
            BABYLON.PhysicsShapeType.BOX,
            { mass, friction: 0.9, restitution: 0.05 },
            this.scene
        );

        cube.metadata = {
            cubeType,
            boxAggregate: agg,
            isInteractable: true,
            onInteract: () => {
                if (!this.player.heldMesh) {
                    this.player.heldMesh = cube;
                }
            },
        };

        return cube;
    }

    createPressurePlate(triggerId, position, color) {
        const plate = BABYLON.MeshBuilder.CreateBox(triggerId + '_plate', {
            width: 3,
            height: 0.2,
            depth: 3,
        }, this.scene);
        plate.position = position.clone();

        const plateTex = createSciFiPanelTexture(this.scene, triggerId + '_panel_dt', {
            size: 512,
            grid: 128,
            lineAlpha: 0.18,
            microNoiseAlpha: 0.05,
        });
        const plateEmissive = createEmissiveStripTexture(this.scene, triggerId + '_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: color.scale(1.0),
            intensity: 1.2,
        });
        const plateMat = createPbrPanelMaterial(this.scene, triggerId + '_mat', {
            baseColor: new BABYLON.Color3(0.18, 0.19, 0.22),
            texture: plateTex,
            textureUScale: 1,
            textureVScale: 1,
            metallic: 0.06,
            roughness: 0.88,
            emissiveColor: color.scale(2.0),
            emissiveTexture: plateEmissive,
        });
        plate.material = plateMat;
        addStaticPhysics(plate, 'BOX');

        const trigger = BABYLON.MeshBuilder.CreateBox(triggerId + '_trigger', {
            width: 2.8,
            height: 0.6,
            depth: 2.8,
        }, this.scene);
        trigger.position = position.clone().add(new BABYLON.Vector3(0, 0.35, 0));
        trigger.isVisible = false;
        trigger.metadata = {
            isPuzzleTrigger: true,
            triggerId,
            requiredCubeType: 'heavy',
        };

        const triggerAgg = addStaticPhysics(trigger, 'BOX');
        triggerAgg.shape.isTrigger = true;
    }

    createSocketTrigger(triggerId, position, color) {
        const socket = BABYLON.MeshBuilder.CreateCylinder(triggerId + '_socket', {
            diameter: 2.3,
            height: 0.3,
            tessellation: 24,
        }, this.scene);
        socket.position = position.clone();

        const socketTex = createSciFiPanelTexture(this.scene, triggerId + '_panel_dt', {
            size: 512,
            grid: 96,
            lineAlpha: 0.18,
            microNoiseAlpha: 0.05,
        });
        const socketEmissive = createEmissiveStripTexture(this.scene, triggerId + '_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: color.scale(1.0),
            intensity: 1.3,
        });
        const mat = createPbrPanelMaterial(this.scene, triggerId + '_mat', {
            baseColor: new BABYLON.Color3(0.10, 0.11, 0.13),
            texture: socketTex,
            textureUScale: 1,
            textureVScale: 1,
            metallic: 0.10,
            roughness: 0.78,
            emissiveColor: color.scale(2.0),
            emissiveTexture: socketEmissive,
        });
        socket.material = mat;
        addStaticPhysics(socket, 'BOX');

        const trigger = BABYLON.MeshBuilder.CreateCylinder(triggerId + '_trigger', {
            diameter: 2.0,
            height: 0.8,
            tessellation: 16,
        }, this.scene);
        trigger.position = position.clone().add(new BABYLON.Vector3(0, 0.4, 0));
        trigger.isVisible = false;
        trigger.metadata = {
            isPuzzleTrigger: true,
            triggerId,
            requiredCubeType: 'conductive',
        };

        const agg = addStaticPhysics(trigger, 'BOX');
        agg.shape.isTrigger = true;
    }

    createLaserSystem(scene) {
        // Tous les éléments laser pour les 9 salles.
        this.ensureLaserBeamShaders();

        // Nettoyage défensif si recréation.
        this.emitters = [];
        this.mirrors = [];
        this.sensors = [];
        this.shutters = [];
        this.splitters = [];

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

        const makeDirectionalSensor = ({ id, position, normalYaw = -Math.PI / 2, maxAngleDeg = 18 }) => {
            const mesh = BABYLON.MeshBuilder.CreatePlane(id, { width: 2.0, height: 2.0, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
            mesh.position = position.clone();
            mesh.rotation.y = normalYaw;
            mesh.isPickable = true;

            const colorOff = new BABYLON.Color3(0.85, 0.2, 1.0);
            const colorOn = new BABYLON.Color3(0.15, 1.0, 0.5);

            const dt = new BABYLON.DynamicTexture(id + '_dt', { width: 512, height: 512 }, scene, true);
            const ctx = dt.getContext();
            ctx.fillStyle = '#141a26';
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 44px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DIR', 256, 256);
            dt.update();

            const mat = new BABYLON.StandardMaterial(id + '_mat', scene);
            mat.diffuseTexture = dt;
            mat.emissiveColor = colorOff.scale(0.35);
            mat.disableLighting = false;
            mesh.material = mat;

            mesh.metadata = {
                ...(mesh.metadata || {}),
                laserBlocker: true,
                laserSensorId: id,
                laserDirectional: true,
                laserMaxAngleCos: Math.cos(BABYLON.Tools.ToRadians(maxAngleDeg)),
            };

            const sensor = { id, mesh, mat, mode: 'directional', colorOff, colorOn };
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

        const makeShutter = ({ id, position, period = 2.2, duty = 0.55, phase = 0 }) => {
            const mesh = BABYLON.MeshBuilder.CreateBox(id, { width: 0.8, height: 2.2, depth: 8.6 }, scene);
            mesh.position = position.clone();
            mesh.isPickable = true;

            const mat = new BABYLON.StandardMaterial(id + '_mat', scene);
            mat.diffuseColor = new BABYLON.Color3(0.22, 0.12, 0.08);
            mat.emissiveColor = new BABYLON.Color3(0.12, 0.05, 0.02);
            mesh.material = mat;

            mesh.metadata = {
                ...(mesh.metadata || {}),
                laserBlocker: true,
            };

            const shutter = { id, mesh, period, duty, phase, basePos: position.clone() };
            this.shutters.push(shutter);
            return shutter;
        };

        // --- Placement des 9 salles ---
        const c0 = this.roomCenterX(0);
        const c1 = this.roomCenterX(1);
        const c2 = this.roomCenterX(2);
        const c3 = this.roomCenterX(3);
        const c4 = this.roomCenterX(4);
        const c5 = this.roomCenterX(5);
        const c6 = this.roomCenterX(6);
        const c7 = this.roomCenterX(7);
        const c8 = this.roomCenterX(8);

        // Salle 1
        makeEmitter({ id: 'r1_emitter', position: new BABYLON.Vector3(c0 - 6, 1.2, -6), color: new BABYLON.Color3(1.0, 0.25, 0.15) });
        makeSensorCylinder({ id: 'r1_sensor', position: new BABYLON.Vector3(c0 + 6, 1.2, 6), colorOff: new BABYLON.Color3(0.9, 0.35, 0.12), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

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

        makeEmitter({ id: 'r2_emitter', position: r2EmitterPos, color: new BABYLON.Color3(0.9, 0.15, 1.0) });
        makeMirror({ id: 'r2_mirror', position: r2MirrorPos, yaw: r2Yaw, pitch: 0, interactive: false, color: new BABYLON.Color3(0.2, 0.95, 1.0) });
        makeSensorCylinder({ id: 'r2_sensor', position: r2SensorPos, colorOff: new BABYLON.Color3(0.2, 0.95, 1.0), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

        // Salle 3 (miroir interactif)
        const e3 = makeEmitter({ id: 'r3_emitter', position: new BABYLON.Vector3(c2 - 7, 1.2, 0), color: new BABYLON.Color3(1.0, 0.55, 0.15), interactive: false, fixed: true });
        const m3 = makeMirror({ id: 'r3_mirror', position: new BABYLON.Vector3(c2, 2.2, 0), yaw: 0, pitch: 0, interactive: true, color: new BABYLON.Color3(0.55, 2.2, 2.6) });
        makeSensorCylinder({ id: 'r3_sensor', position: new BABYLON.Vector3(c2 + 7, 1.2, 6), colorOff: new BABYLON.Color3(1.0, 0.55, 0.15), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

        // Salle 4 (shutter)
        makeEmitter({ id: 'r4_emitter', position: new BABYLON.Vector3(c3 - 7, 1.2, -6), color: new BABYLON.Color3(0.2, 1.0, 0.55) });
        makeShutter({ id: 'r4_shutter', position: new BABYLON.Vector3(c3, 1.6, -2.0), period: 2.1, duty: 0.55, phase: 0.2 });
        makeSensorCylinder({ id: 'r4_sensor', position: new BABYLON.Vector3(c3 + 7, 1.2, 6), colorOff: new BABYLON.Color3(0.2, 1.0, 0.55), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

        // Salle 5 (charge)
        makeEmitter({ id: 'r5_emitter', position: new BABYLON.Vector3(c4 - 7, 1.2, -6), color: new BABYLON.Color3(0.25, 0.65, 1.0) });
        makeSensorCylinder({ id: 'r5_sensor', position: new BABYLON.Vector3(c4 + 7, 1.2, 6), colorOff: new BABYLON.Color3(0.25, 0.65, 1.0), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22), mode: 'charge' });

        // Salle 6 (splitter)
        const r6EmitterPos = new BABYLON.Vector3(c5 - 7, 1.2, 0);
        const r6PrismPos = new BABYLON.Vector3(c5 - 1.8, 1.6, 0);
        const r6SensorAPos = new BABYLON.Vector3(c5 + 7, 1.2, 6);
        const r6SensorBPos = new BABYLON.Vector3(c5 + 7, 1.2, -6);

        // Calibre les 2 directions de split pour aller naturellement vers les deux capteurs.
        // (La rotation du prisme est ensuite possible via interaction.)
        const r6DirA = r6SensorAPos.subtract(r6PrismPos).normalize();
        const r6DirB = r6SensorBPos.subtract(r6PrismPos).normalize();

        makeEmitter({ id: 'r6_emitter', position: r6EmitterPos, color: new BABYLON.Color3(1.0, 0.25, 0.8) });
        makeSplitter({
            id: 'r6_prism',
            position: r6PrismPos,
            yaw: 0,
            splitDirsLocal: [r6DirA, r6DirB],
            interactive: true,
        });
        makeSensorCylinder({ id: 'r6_sensor_a', position: r6SensorAPos, colorOff: new BABYLON.Color3(1.0, 0.25, 0.8), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });
        makeSensorCylinder({ id: 'r6_sensor_b', position: r6SensorBPos, colorOff: new BABYLON.Color3(1.0, 0.25, 0.8), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

        // Salle 7 (directionnel)
        const r7EmitterPos = new BABYLON.Vector3(c6 - 7, 1.2, -6);
        const r7SensorPos = new BABYLON.Vector3(c6 + 7, 2.2, 6);

        // Miroir placé "en face" du capteur pour que l'inclinaison soit possible et confortable.
        // (Le capteur est directionnel: il faut aussi arriver du bon côté/angle.)
        const r7MirrorPos = new BABYLON.Vector3(c6 + 4.0, 2.2, 6.0);

        // Orientation initiale: renvoie du centre du miroir vers le capteur (pitch inutile ici: mêmes hauteurs).
        const r7In = r7MirrorPos.subtract(r7EmitterPos).normalize();
        const r7Out = r7SensorPos.subtract(r7MirrorPos).normalize();
        let r7Yaw = Math.PI / 4;
        const r7N = r7In.subtract(r7Out);
        if (r7N.lengthSquared() > 1e-6) {
            const nn = r7N.normalize();
            r7Yaw = Math.atan2(nn.x, nn.z);
        }

        makeEmitter({ id: 'r7_emitter', position: r7EmitterPos, color: new BABYLON.Color3(0.85, 0.2, 1.0) });
        makeMirror({ id: 'r7_mirror', position: r7MirrorPos, yaw: r7Yaw, pitch: 0, interactive: true, color: new BABYLON.Color3(0.2, 0.95, 1.0) });
        // Capteur directionnel: il accepte le rayon uniquement si celui-ci arrive "dans l'axe" de sa face.
        // Ici, le miroir est à gauche du capteur (x plus petit), donc le rayon arrive typiquement vers +X.
        // La face du capteur doit donc avoir une normale vers -X => normalYaw = -PI/2.
        makeDirectionalSensor({ id: 'r7_sensor', position: r7SensorPos, normalYaw: -Math.PI / 2, maxAngleDeg: 18 });

        // Salle 8 (cible mobile)
        makeEmitter({ id: 'r8_emitter', position: new BABYLON.Vector3(c7 - 7, 1.2, -6), color: new BABYLON.Color3(1.0, 0.55, 0.15) });
        makeSensorCylinder({ id: 'r8_sensor', position: new BABYLON.Vector3(c7 + 7, 1.2, 0), colorOff: new BABYLON.Color3(1.0, 0.55, 0.15), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22), mode: 'dwell' });
        this._movingSensor = this.sensors.find((s) => s.id === 'r8_sensor');
        this._movingSensorBasePos = this._movingSensor.mesh.position.clone();

        // Salle 9 (miroir portable posé)
        makeEmitter({ id: 'r9_emitter', position: new BABYLON.Vector3(c8 - 7, 1.2, -6), color: new BABYLON.Color3(0.2, 1.0, 0.55) });
        makeSensorCylinder({ id: 'r9_sensor', position: new BABYLON.Vector3(c8 + 7, 1.2, 6), colorOff: new BABYLON.Color3(0.2, 1.0, 0.55), colorOn: new BABYLON.Color3(0.12, 0.95, 0.22) });

        // Stand + miroir portable (réfléchit uniquement quand snap sur le stand).
        this._mirrorStand = BABYLON.MeshBuilder.CreateBox('r9_stand', { width: 2.2, height: 1.0, depth: 2.2 }, scene);
        this._mirrorStand.position = new BABYLON.Vector3(c8, 0.5, 0);
        const standMat = new BABYLON.StandardMaterial('r9_stand_mat', scene);
        standMat.diffuseColor = new BABYLON.Color3(0.16, 0.17, 0.20);
        standMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.04);
        this._mirrorStand.material = standMat;
        addStaticPhysics(this._mirrorStand, 'BOX');

        this._portableMirror = BABYLON.MeshBuilder.CreateBox('r9_portable_mirror', { width: 0.22, height: 2.4, depth: 2.4 }, scene);
        this._portableMirror.position = new BABYLON.Vector3(c8 - 3.0, 1.2, 6.0);
        this._portableMirror.rotationQuaternion = BABYLON.Quaternion.Identity();
        this._portableMirror.isPickable = true;

        const pmMat = new BABYLON.StandardMaterial('r9_portable_mirror_mat', scene);
        pmMat.diffuseColor = new BABYLON.Color3(0.10, 0.11, 0.13);
        pmMat.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.25);
        this._portableMirror.material = pmMat;

        const pmAgg = new BABYLON.PhysicsAggregate(
            this._portableMirror,
            BABYLON.PhysicsShapeType.BOX,
            { mass: 18, friction: 0.8, restitution: 0.05 },
            scene
        );

        this._portableMirrorInitPos = this._portableMirror.position.clone();
        this._portableMirrorInitRot = this._portableMirror.rotationQuaternion.clone();

        this._portableMirror.metadata = {
            ...(this._portableMirror.metadata || {}),
            boxAggregate: pmAgg,
            isInteractable: true,
            onInteract: () => {
                if (!this.player.heldMesh) {
                    // Décoller du stand si besoin
                    this._portableMirror.metadata.laserReflector = false;
                    pmAgg.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                    this.player.heldMesh = this._portableMirror;
                }
            },
            // par défaut: ne réfléchit pas (uniquement posé/snap)
            laserReflector: false,
        };

        // Orientations initiales
        // E3 pointe vers le miroir interactif de la Salle 3.
        const toM3 = m3.mesh.position.subtract(e3.mesh.position);
        const yaw3 = Math.atan2(toM3.z, toM3.x);
        const pitch3 = Math.asin(BABYLON.Scalar.Clamp(toM3.y / Math.max(0.0001, toM3.length()), -1, 1));
        e3.yaw = yaw3;
        e3.pitch = pitch3;

        // Appliquer rotations initiales.
        this.applyLaserVisualRotations();

        // Préparer un pool de beams (VFX). On active/désactive selon le nombre de segments.
        this._laserBeamPool = [];
        for (let i = 0; i < 64; i += 1) {
            this._laserBeamPool.push(this.createLaserBeamCross(scene, `laserBeam_${i}`, null, { width: 0.065 }));
        }

        this.updateLaserControlVisuals();
    }

    toggleLaserControl(target) {
        const cur = this.laserControl.active;
        const same = !!cur && !!target && cur.type === target.type && cur.id === target.id;
        this.laserControl.active = same ? null : target;
        this.updateLaserControlVisuals();
    }

    updateLaserControlVisuals() {
        const active = this.laserControl.active;

        for (const e of this.emitters || []) {
            if (!e?.mat || !e?.baseEmissive) continue;
            const isActive = active?.type === 'emitter' && active?.id === e.id;
            e.mat.emissiveColor = isActive
                ? new BABYLON.Color3(2.2, 1.1, 0.35)
                : e.baseEmissive.clone();
        }

        for (const m of this.mirrors || []) {
            if (!m?.mat || !m?.baseEmissive) continue;
            const isActive = active?.type === 'mirror' && active?.id === m.id;
            m.mat.emissiveColor = isActive
                ? new BABYLON.Color3(0.55, 2.2, 2.6)
                : m.baseEmissive.clone();
        }

        for (const s of this.splitters || []) {
            if (!s?.mat || !s?.baseEmissive) continue;
            const isActive = active?.type === 'splitter' && active?.id === s.id;
            s.mat.emissiveColor = isActive
                ? new BABYLON.Color3(0.65, 1.6, 2.2)
                : s.baseEmissive.clone();
        }
    }

    updateLaserControls() {
        if (this._keyJustPressed?.KeyT || this._keyJustPressed?.Escape) {
            this.laserControl.active = null;
            this.updateLaserControlVisuals();
        }

        const active = this.laserControl.active;
        if (!active) return;

        const inputMap = this.player?.input?.inputMap || {};
        const dt = this.deltaTime || 0;
        let yawDelta = 0;
        let pitchDelta = 0;

        const keyDown = (...codes) => codes.some((c) => !!inputMap[c]);

        if (keyDown('KeyJ', 'ArrowLeft', 'Numpad4')) yawDelta += this.laserControl.yawSpeed * dt;
        if (keyDown('KeyL', 'ArrowRight', 'Numpad6')) yawDelta -= this.laserControl.yawSpeed * dt;
        if (keyDown('KeyI', 'ArrowUp', 'Numpad8')) pitchDelta += this.laserControl.pitchSpeed * dt;
        if (keyDown('KeyK', 'ArrowDown', 'Numpad5')) pitchDelta -= this.laserControl.pitchSpeed * dt;

        if (active.type === 'emitter') {
            const e = (this.emitters || []).find((x) => x.id === active.id);
            if (!e || e.fixed) return;
            e.yaw += yawDelta;
            e.pitch = BABYLON.Scalar.Clamp(e.pitch + pitchDelta, -1.0, 1.0);
        }

        if (active.type === 'mirror') {
            const m = (this.mirrors || []).find((x) => x.id === active.id);
            if (!m || !m.interactive) return;
            m.yaw += yawDelta;
            m.pitch = BABYLON.Scalar.Clamp(m.pitch + pitchDelta, -0.65, 0.65);
        }

        if (active.type === 'splitter') {
            const s = (this.splitters || []).find((x) => x.id === active.id);
            if (!s || !s.interactive) return;
            s.yaw += yawDelta;
        }

        this.applyLaserVisualRotations();
    }

    applyLaserVisualRotations() {
        for (const e of this.emitters || []) {
            if (!e?.mesh) continue;
            e.mesh.rotation.x = -e.pitch;
            e.mesh.rotation.y = e.yaw;
            e.mesh.rotation.z = Math.PI / 2;
        }

        for (const m of this.mirrors || []) {
            if (!m?.mesh) continue;
            m.mesh.rotation.y = m.yaw;
            m.mesh.rotation.x = m.pitch;
        }

        for (const s of this.splitters || []) {
            if (!s?.mesh) continue;
            s.mesh.rotation.y = s.yaw;
        }

        // Miroir portable: son orientation est laissée telle quelle (joueur peut le bouger),
        // mais quand il est snap sur le stand on le remet droit dans updateRoomAnimations().
    }

    getDirectionFromYawPitch(yaw, pitch) {
        const cp = Math.cos(pitch);
        return new BABYLON.Vector3(
            cp * Math.cos(yaw),
            Math.sin(pitch),
            cp * Math.sin(yaw)
        ).normalize();
    }

    updateRoomAnimations() {
        const t = this._now || 0;

        // Shutters: déplacés hors du chemin quand "ouverts".
        for (const s of this.shutters || []) {
            if (!s?.mesh || !isFinite(s.period) || s.period <= 0) continue;
            const u = ((t + (s.phase || 0)) % s.period) / s.period;
            const open = u < (s.duty ?? 0.5);

            const yOffset = open ? 3.8 : 0;
            s.mesh.position.y = (s.basePos?.y ?? s.mesh.position.y) + yOffset;
            if (s.mesh.metadata) s.mesh.metadata.laserBlocker = !open;

            const mat = s.mesh.material;
            if (mat?.emissiveColor) {
                mat.emissiveColor = open
                    ? new BABYLON.Color3(0.25, 0.12, 0.06)
                    : new BABYLON.Color3(0.12, 0.05, 0.02);
            }
        }

        // Salle 8: capteur mobile (oscille sur Z).
        if (this._movingSensor?.mesh && this._movingSensorBasePos) {
            const amp = 6.0;
            const speed = 1.25;
            this._movingSensor.mesh.position.z = this._movingSensorBasePos.z + Math.sin(t * speed) * amp;
        }

        // Salle 9: miroir portable (réfléchit uniquement s'il est snap sur le stand).
        if (this._portableMirror && this._mirrorStand && this._portableMirror.metadata?.boxAggregate) {
            const pm = this._portableMirror;
            const agg = pm.metadata.boxAggregate;
            const stand = this._mirrorStand;

            const isHeld = this.player?.heldMesh === pm;
            if (isHeld) {
                pm.metadata.snappedToStand = false;
                pm.metadata.laserReflector = false;

                // Permet d'orienter le miroir en main (comme un miroir interactif),
                // sans utiliser le système E/IJKL des devices (E sert à lâcher côté Player).
                // Pour éviter les conflits, on n'active ça que si aucun device laser n'est sélectionné.
                if (!this.laserControl?.active) {
                    const inputMap = this.player?.input?.inputMap || {};
                    const dt = this.deltaTime || 0;

                    const keyDown = (...codes) => codes.some((c) => !!inputMap[c]);

                    let yawDelta = 0;
                    let pitchDelta = 0;
                    const yawSpeed = this.laserControl?.yawSpeed ?? 1.1;
                    const pitchSpeed = this.laserControl?.pitchSpeed ?? 0.8;

                    if (keyDown('KeyJ', 'ArrowLeft', 'Numpad4')) yawDelta += yawSpeed * dt;
                    if (keyDown('KeyL', 'ArrowRight', 'Numpad6')) yawDelta -= yawSpeed * dt;
                    if (keyDown('KeyI', 'ArrowUp', 'Numpad8')) pitchDelta += pitchSpeed * dt;
                    if (keyDown('KeyK', 'ArrowDown', 'Numpad5')) pitchDelta -= pitchSpeed * dt;

                    // Init de référence au moment où on prend le miroir.
                    if (!pm.metadata._heldRotInit) {
                        pm.metadata._heldRotInit = true;
                        pm.metadata._heldBaseQuat = (pm.rotationQuaternion || BABYLON.Quaternion.Identity()).clone();
                        pm.metadata._heldYaw = 0;
                        pm.metadata._heldPitch = 0;
                    }

                    if (yawDelta !== 0 || pitchDelta !== 0) {
                        pm.metadata._heldYaw += yawDelta;
                        pm.metadata._heldPitch = BABYLON.Scalar.Clamp((pm.metadata._heldPitch || 0) + pitchDelta, -0.85, 0.85);

                        const baseQ = pm.metadata._heldBaseQuat || BABYLON.Quaternion.Identity();
                        const dq = BABYLON.Quaternion.RotationYawPitchRoll(pm.metadata._heldYaw || 0, pm.metadata._heldPitch || 0, 0);
                        pm.rotationQuaternion = dq.multiply(baseQ);

                        try {
                            agg.body.setAngularVelocity(BABYLON.Vector3.Zero());
                            agg.body.setTargetTransform(pm.position, pm.rotationQuaternion);
                        } catch {
                            // noop
                        }
                    }
                }

                return;
            }

            // On n'est plus tenu: réinitialise l'état de rotation "en main".
            pm.metadata._heldRotInit = false;
            pm.metadata._heldBaseQuat = null;
            pm.metadata._heldYaw = 0;
            pm.metadata._heldPitch = 0;

            const dx = Math.abs(pm.position.x - stand.position.x);
            const dz = Math.abs(pm.position.z - stand.position.z);

            // Snap plus permissif: si le miroir tombe "sur" le stand, on le verrouille.
            // (Le distXZ strict rendait le placement trop difficile et empêchait la réflexion.)
            const ext = stand.getBoundingInfo?.()?.boundingBox?.extendSizeWorld;
            const halfX = (ext?.x ?? 1.1) + 0.35;
            const halfZ = (ext?.z ?? 1.1) + 0.35;
            const inFootprint = dx <= halfX && dz <= halfZ;

            const targetY = stand.position.y + 1.2;
            const shouldSnap = inFootprint && Math.abs(pm.position.y - targetY) < 1.8;
            const wasSnapped = !!pm.metadata.snappedToStand;

            if (shouldSnap) {
                const targetPos = stand.position.clone().add(new BABYLON.Vector3(0, 1.2, 0));

                // Oriente la grande face (normale locale +X, car la box est "fine" sur X)
                // pour qu'il y ait une solution simple: émetteur -> miroir -> capteur.
                const e = (this.emitters || []).find((x) => x.id === 'r9_emitter');
                const s = (this.sensors || []).find((x) => x.id === 'r9_sensor');

                let n = BABYLON.Axis.X.clone();
                if (e?.mesh && s?.mesh) {
                    const inDir = targetPos.subtract(e.mesh.position).normalize();
                    const outDir = s.mesh.position.subtract(targetPos).normalize();
                    const nn = inDir.subtract(outDir);
                    if (nn.lengthSquared() > 1e-6) {
                        n = nn.normalize();
                    }
                }

                const from = BABYLON.Axis.X;
                const to = n;
                const dot = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(from, to), -1, 1);
                let q = BABYLON.Quaternion.Identity();
                if (dot < 0.999999) {
                    if (dot < -0.999999) {
                        q = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI);
                    } else {
                        const axis = BABYLON.Vector3.Cross(from, to).normalize();
                        const angle = Math.acos(dot);
                        q = BABYLON.Quaternion.RotationAxis(axis, angle);
                    }
                }

                pm.rotationQuaternion = q;
                pm.position.copyFrom(targetPos);

                try {
                    if (!wasSnapped) {
                        agg.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
                    }
                    agg.body.setLinearVelocity(BABYLON.Vector3.Zero());
                    agg.body.setAngularVelocity(BABYLON.Vector3.Zero());
                    agg.body.setTargetTransform(pm.position, pm.rotationQuaternion);
                } catch {
                    // noop
                }

                pm.metadata.snappedToStand = true;
                pm.metadata.laserReflector = true;

                // Feedback visuel: vert = réfléchi (actif sur le stand).
                if (pm.material?.emissiveColor) {
                    pm.material.emissiveColor = new BABYLON.Color3(0.12, 0.95, 0.22).scale(0.85);
                }
            } else {
                if (wasSnapped) {
                    try {
                        agg.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                    } catch {
                        // noop
                    }
                }
                pm.metadata.snappedToStand = false;
                pm.metadata.laserReflector = false;

                // Feedback visuel: bleu = décor (pas de réflexion).
                if (pm.material?.emissiveColor) {
                    pm.material.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.25);
                }
            }
        }
    }

    createMovingPlatform(scene) {
        this.movingPlatform = BABYLON.MeshBuilder.CreateBox('movingPlatform', {
            width: 5,
            height: 0.8,
            depth: 5,
        }, scene);
        // Plateforme placée sous le balcon du miroir.
        this.movingPlatform.position = new BABYLON.Vector3(10, 1.5, -2.5);

        const mat = new BABYLON.StandardMaterial('movingPlatformMat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.25, 0.55, 0.95);
        mat.emissiveColor = new BABYLON.Color3(0.05, 0.08, 0.12);
        this.movingPlatform.material = mat;

        this.platformAggregate = new BABYLON.PhysicsAggregate(
            this.movingPlatform,
            BABYLON.PhysicsShapeType.BOX,
            { mass: 0, friction: 0.7, restitution: 0.1 },
            scene
        );
        this.platformAggregate.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
        this.platformBasePos = this.movingPlatform.position.clone();
    }

    createPlatformReceiver(scene) {
        if (!this.movingPlatform) return;

        const receiver = BABYLON.MeshBuilder.CreateCylinder('platformReceiver', {
            diameter: 1.1,
            height: 0.4,
            tessellation: 18,
        }, scene);

        receiver.parent = this.movingPlatform;
        // Positionné vers l'émetteur (approx) pour être facile à viser.
        receiver.position = new BABYLON.Vector3(-1.4, 0.65, -1.4);
        receiver.rotation.x = Math.PI / 2;

        const mat = new BABYLON.StandardMaterial('platformReceiverMat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.25, 0.12, 0.05);
        mat.emissiveColor = new BABYLON.Color3(0.08, 0.04, 0.02);
        receiver.material = mat;

        receiver.isPickable = true;
        this.platformReceiver = receiver;
        this.platformReceiverMat = mat;
    }

    createMirrorBalcony(scene) {
        const balcony = BABYLON.MeshBuilder.CreateBox('mirrorBalcony', {
            width: 7,
            height: 0.6,
            depth: 7,
        }, scene);
        balcony.position = new BABYLON.Vector3(12, 5.3, -2.5);

        const mat = new BABYLON.StandardMaterial('mirrorBalconyMat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.18, 0.20, 0.24);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.04);
        balcony.material = mat;

        addStaticPhysics(balcony, 'BOX');
        this.mirrorBalcony = balcony;
    }

    createJumpPad(scene, position) {
        this.jumpPad = BABYLON.MeshBuilder.CreateCylinder('jumpPad', {
            diameter: 3,
            height: 0.2,
            tessellation: 24,
        }, scene);
        this.jumpPad.position = position.clone();

        const mat = new BABYLON.StandardMaterial('jumpPadMat', scene);
        mat.diffuseColor = new BABYLON.Color3(1.0, 0.45, 0.15);
        mat.emissiveColor = new BABYLON.Color3(0.35, 0.15, 0.08);
        this.jumpPad.material = mat;
        addStaticPhysics(this.jumpPad, 'BOX');
    }

    createCheckpointPad(name, position, color) {
        const pad = BABYLON.MeshBuilder.CreateCylinder(name, {
            diameter: 2.8,
            height: 0.15,
            tessellation: 20,
        }, this.scene);
        pad.position = position.clone();

        const mat = new BABYLON.StandardMaterial(name + '_mat', this.scene);
        mat.diffuseColor = color;
        mat.emissiveColor = color.scale(0.35);
        pad.material = mat;

        addStaticPhysics(pad, 'BOX');
        return pad;
    }

    createExitBeacon(scene) {
        const beacon = BABYLON.MeshBuilder.CreateCylinder('exitBeacon', {
            diameter: 1.8,
            height: 6,
            tessellation: 16,
        }, scene);
        beacon.position = new BABYLON.Vector3(88, 3, 0);

        this.exitBeaconMat = new BABYLON.StandardMaterial('exitBeaconMat', scene);
        this.exitBeaconMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.05);
        this.exitBeaconMat.emissiveColor = new BABYLON.Color3(0.12, 0.05, 0.01);
        beacon.material = this.exitBeaconMat;
        addStaticPhysics(beacon, 'BOX');
    }

    createHintPanel(name, position, text) {
        const panel = BABYLON.MeshBuilder.CreatePlane(name, { width: 20, height: 3.4 }, this.scene);
        panel.position = position.clone();
        panel.rotation.y = Math.PI / 2;
        panel.isPickable = false;

        const dt = new BABYLON.DynamicTexture(name + '_dt', { width: 1536, height: 512 }, this.scene, true);
        this.drawWrappedHintText(dt, text, {
            font: 'bold 36px Arial',
            textColor: 'white',
            backgroundColor: '#1E2A3A',
            padding: 60,
            lineHeight: 56,
            startY: 120,
        });

        const mat = new BABYLON.StandardMaterial(name + '_mat', this.scene);
        mat.diffuseTexture = dt;
        mat.emissiveTexture = dt;
        mat.disableLighting = true;
        panel.material = mat;
    }

    drawWrappedHintText(dynamicTexture, text, options) {
        const ctx = dynamicTexture.getContext();
        const width = dynamicTexture.getSize().width;
        const height = dynamicTexture.getSize().height;

        const font = options.font;
        const textColor = options.textColor;
        const backgroundColor = options.backgroundColor;
        const padding = options.padding;
        const lineHeight = options.lineHeight;
        const startY = options.startY;

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        ctx.font = font;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const maxLineWidth = width - padding * 2;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(candidate).width <= maxLineWidth) {
                currentLine = candidate;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);

        for (let i = 0; i < lines.length; i += 1) {
            const y = startY + i * lineHeight;
            if (y > height - padding) break;
            ctx.fillText(lines[i], padding, y);
        }

        dynamicTexture.update();
    }

    createChamberBIndicators(scene) {
        this.chamberBLabel = BABYLON.MeshBuilder.CreatePlane('chamberBLabel', { width: 12, height: 2.2 }, scene);
        this.chamberBLabel.position = new BABYLON.Vector3(24, 3.4, 8.8);
        this.chamberBLabel.rotation.y = Math.PI;
        this.chamberBLabel.isPickable = false;

        const dt = new BABYLON.DynamicTexture('chamberBLabel_dt', { width: 1024, height: 256 }, scene, true);
        this.drawWrappedHintText(dt, 'CHAMBRE B: 2 CONDITIONS REQUISES', {
            font: 'bold 42px Arial',
            textColor: 'white',
            backgroundColor: '#1A2433',
            padding: 40,
            lineHeight: 60,
            startY: 128,
        });

        const labelMat = new BABYLON.StandardMaterial('chamberBLabel_mat', scene);
        labelMat.diffuseTexture = dt;
        labelMat.emissiveTexture = dt;
        labelMat.disableLighting = true;
        this.chamberBLabel.material = labelMat;

        this.indicatorLaser = BABYLON.MeshBuilder.CreateSphere('indicatorLaser', { diameter: 0.8, segments: 12 }, scene);
        this.indicatorLaser.position = new BABYLON.Vector3(20.8, 2.2, 8.8);
        this.indicatorSocket = BABYLON.MeshBuilder.CreateSphere('indicatorSocket', { diameter: 0.8, segments: 12 }, scene);
        this.indicatorSocket.position = new BABYLON.Vector3(27.2, 2.2, 8.8);

        this.indicatorLaserMat = new BABYLON.StandardMaterial('indicatorLaser_mat', scene);
        this.indicatorSocketMat = new BABYLON.StandardMaterial('indicatorSocket_mat', scene);
        this.indicatorLaser.material = this.indicatorLaserMat;
        this.indicatorSocket.material = this.indicatorSocketMat;

        const laserText = BABYLON.MeshBuilder.CreatePlane('indicatorLaserText', { width: 3.8, height: 0.9 }, scene);
        laserText.position = new BABYLON.Vector3(20.8, 1.2, 8.8);
        laserText.rotation.y = Math.PI;
        laserText.isPickable = false;
        const laserDt = new BABYLON.DynamicTexture('indicatorLaserText_dt', { width: 512, height: 128 }, scene, true);
        this.drawWrappedHintText(laserDt, 'LASER', {
            font: 'bold 40px Arial',
            textColor: 'white',
            backgroundColor: '#1A2433',
            padding: 24,
            lineHeight: 48,
            startY: 64,
        });
        const laserTextMat = new BABYLON.StandardMaterial('indicatorLaserText_mat', scene);
        laserTextMat.diffuseTexture = laserDt;
        laserTextMat.emissiveTexture = laserDt;
        laserTextMat.disableLighting = true;
        laserText.material = laserTextMat;

        const socketText = BABYLON.MeshBuilder.CreatePlane('indicatorSocketText', { width: 3.8, height: 0.9 }, scene);
        socketText.position = new BABYLON.Vector3(27.2, 1.2, 8.8);
        socketText.rotation.y = Math.PI;
        socketText.isPickable = false;
        const socketDt = new BABYLON.DynamicTexture('indicatorSocketText_dt', { width: 512, height: 128 }, scene, true);
        this.drawWrappedHintText(socketDt, 'SOCKET', {
            font: 'bold 34px Arial',
            textColor: 'white',
            backgroundColor: '#1A2433',
            padding: 24,
            lineHeight: 48,
            startY: 64,
        });
        const socketTextMat = new BABYLON.StandardMaterial('indicatorSocketText_mat', scene);
        socketTextMat.diffuseTexture = socketDt;
        socketTextMat.emissiveTexture = socketDt;
        socketTextMat.disableLighting = true;
        socketText.material = socketTextMat;
    }

    registerCustomTriggerObserver() {
        this.havokPlugin.onTriggerCollisionObservable.add((ev) => {
            const triggerNode = ev.collidedAgainst?.transformNode?.metadata?.isPuzzleTrigger
                ? ev.collidedAgainst.transformNode
                : ev.collider?.transformNode?.metadata?.isPuzzleTrigger
                    ? ev.collider.transformNode
                    : null;

            if (!triggerNode) return;

            const otherNode = triggerNode === ev.collidedAgainst?.transformNode
                ? ev.collider?.transformNode
                : ev.collidedAgainst?.transformNode;

            const triggerId = triggerNode.metadata.triggerId;
            const requiredCubeType = triggerNode.metadata.requiredCubeType;
            const isValidCube = otherNode?.metadata?.cubeType === requiredCubeType;
            if (!isValidCube) return;

            if (ev.type === 'TRIGGER_ENTERED') {
                this.triggerCounters[triggerId] += 1;
            } else if (ev.type === 'TRIGGER_EXITED') {
                this.triggerCounters[triggerId] = Math.max(0, this.triggerCounters[triggerId] - 1);
            }

            this.puzzleState[triggerId] = this.triggerCounters[triggerId] > 0;
        });
    }

    evaluatePuzzleLogic() {
        const dt = this.deltaTime || 0;
        const sensorsHit = this.puzzleState?.sensors || {};
        const charge = this.puzzleState?.charge || (this.puzzleState.charge = { room5: 0, room8: 0 });

        // Salle 5: capteur à charge (remplissage si touché, légère décroissance sinon).
        {
            const CHARGE_TIME_S = 1.4;
            const DECAY_TIME_S = 2.0;
            if (sensorsHit.r5_sensor) {
                charge.room5 = BABYLON.Scalar.Clamp(charge.room5 + (dt / CHARGE_TIME_S), 0, 1);
            } else {
                charge.room5 = BABYLON.Scalar.Clamp(charge.room5 - (dt / DECAY_TIME_S), 0, 1);
            }
        }

        // Salle 8: dwell (doit rester sur la cible mobile assez longtemps, reset si perdu).
        {
            const DWELL_TIME_S = 1.0;
            if (sensorsHit.r8_sensor) {
                charge.room8 = BABYLON.Scalar.Clamp(charge.room8 + (dt / DWELL_TIME_S), 0, 1);
            } else {
                charge.room8 = 0;
            }
        }

        // Feedback capteurs.
        for (const s of this.sensors || []) {
            if (!s?.mat || !s?.colorOff || !s?.colorOn) continue;

            let t = sensorsHit[s.id] ? 1 : 0;
            if (s.id === 'r5_sensor') t = charge.room5;
            if (s.id === 'r8_sensor') t = charge.room8;

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

        openDoor(0, !!sensorsHit.r1_sensor);
        openDoor(1, !!sensorsHit.r2_sensor);
        openDoor(2, !!sensorsHit.r3_sensor);
        openDoor(3, !!sensorsHit.r4_sensor);
        openDoor(4, charge.room5 >= 0.999);
        openDoor(5, !!sensorsHit.r6_sensor_a && !!sensorsHit.r6_sensor_b);
        openDoor(6, !!sensorsHit.r7_sensor);
        openDoor(7, charge.room8 >= 0.999);
    }

    updateMovingPlatform() {
        if (!this.platformAggregate) return;

        const chargeRaw = this.platformEnabled ? (this.platformCharge ?? 0) : 0;
        const t = BABYLON.Scalar.Clamp(chargeRaw, 0, 1);
        const eased = t * t * (3 - 2 * t);

        const lift = (this.platformMaxLift ?? 4.0) * eased;
        const targetPos = this.platformBasePos.add(new BABYLON.Vector3(0, lift, 0));

        this.platformAggregate.body.setTargetTransform(
            targetPos,
            this.movingPlatform.rotationQuaternion || BABYLON.Quaternion.Identity()
        );
    }

    updateLaserSystem() {
        const scene = this.scene;
        const dt = this.deltaTime || 0;

        if (!scene || !this.emitters?.length || !this._laserBeamPool?.length) return;

        // Reset hits (par frame).
        if (this.puzzleState?.sensors) {
            for (const s of this.sensors || []) {
                this.puzzleState.sensors[s.id] = false;
            }
        }

        // Shader time.
        this._laserTime = (this._laserTime || 0) + dt;
        for (const mat of this._laserBeamMats.values()) {
            try {
                mat.setFloat('time', this._laserTime);
            } catch {
                // noop
            }
        }

        const EPS = 0.06;
        const MAX_DIST = Math.max(120, (this.CORRIDOR_LENGTH || 160) + 40);
        const MAX_BOUNCES = 5;
        const MAX_RAYS = 160;

        const emitterMeshes = new Set((this.emitters || []).map((e) => e.mesh).filter(Boolean));

        const colorKey = (c) => `${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`;

        const getLaserMaterial = (color) => {
            const key = colorKey(color);
            const cached = this._laserBeamMats.get(key);
            if (cached) return cached;

            const mat = new BABYLON.ShaderMaterial(
                `laserBeamMat_${key}`,
                scene,
                { vertex: 'laserBeam', fragment: 'laserBeam' },
                {
                    attributes: ['position', 'uv'],
                    uniforms: ['worldViewProjection', 'time', 'beamLength', 'intensity', 'beamColor'],
                }
            );
            mat.backFaceCulling = false;
            mat.alphaMode = BABYLON.Engine.ALPHA_ADD;
            mat.disableDepthWrite = true;

            mat.setFloat('time', this._laserTime);
            mat.setFloat('beamLength', 12.0);
            mat.setFloat('intensity', 1.0);
            mat.setColor3('beamColor', color);

            this._laserBeamMats.set(key, mat);
            return mat;
        };

        const pickPredicate = (ignoreMesh) => (m) => {
            if (!m) return false;
            if (m === ignoreMesh) return false;
            if (emitterMeshes.has(m)) return false;
            const md = m.metadata;
            return !!md?.laserBlocker || !!md?.laserReflector || !!md?.laserSplitter || !!md?.laserSensorId;
        };

        const markSensorHit = (mesh, rayDir) => {
            const md = mesh?.metadata;
            const sensorId = md?.laserSensorId;
            if (!sensorId || !this.puzzleState?.sensors) return;

            if (md?.laserDirectional) {
                const n = mesh.getDirection(BABYLON.Axis.Z).normalize();
                const cos = BABYLON.Vector3.Dot(n, rayDir.scale(-1));
                const minCos = md?.laserMaxAngleCos ?? 0.95;
                if (cos >= minCos) {
                    this.puzzleState.sensors[sensorId] = true;
                }
                return;
            }

            this.puzzleState.sensors[sensorId] = true;
        };

        const queue = [];
        for (const e of this.emitters || []) {
            if (!e?.mesh) continue;
            if (e.enabled === false) continue;
            const dir = this.getDirectionFromYawPitch(e.yaw || 0, e.pitch || 0);
            const start = e.mesh.getAbsolutePosition().add(dir.scale(1.25));
            queue.push({ origin: start, dir, color: e.color || new BABYLON.Color3(1, 0.2, 0.2), depth: 0, ignore: e.mesh });
        }

        let beamIndex = 0;
        let rayCount = 0;

        while (queue.length && beamIndex < this._laserBeamPool.length && rayCount < MAX_RAYS) {
            rayCount += 1;

            const { origin, dir, color, depth, ignore } = queue.shift();
            if (!origin || !dir) continue;

            const ray = new BABYLON.Ray(origin, dir, MAX_DIST);
            const hit = scene.pickWithRay(ray, pickPredicate(ignore));

            const end = hit?.hit ? hit.pickedPoint : origin.add(dir.scale(MAX_DIST));

            const beam = this._laserBeamPool[beamIndex++];
            const mat = getLaserMaterial(color);
            beam.p1.material = mat;
            beam.p2.material = mat;
            this.setLaserBeamSegment(beam, mat, origin, end);

            if (!hit?.hit || !hit.pickedMesh) continue;

            const mesh = hit.pickedMesh;
            const md = mesh.metadata || {};

            // Capteur
            if (md.laserSensorId) {
                markSensorHit(mesh, dir);
            }

            if (depth >= MAX_BOUNCES) continue;

            // Splitter (prisme)
            if (md.laserSplitter && Array.isArray(md.splitDirsLocal)) {
                const wm = mesh.getWorldMatrix();
                for (const dLocal of md.splitDirsLocal) {
                    if (!dLocal) continue;
                    const dWorld = BABYLON.Vector3.TransformNormal(dLocal, wm).normalize();
                    queue.push({
                        origin: hit.pickedPoint.add(dWorld.scale(EPS)),
                        dir: dWorld,
                        color,
                        depth: depth + 1,
                        ignore: mesh,
                    });
                }
                continue;
            }

            // Réflecteur (miroir)
            if (md.laserReflector) {
                let n = hit.getNormal(true);
                if (!n) {
                    n = mesh.getDirection(BABYLON.Axis.Z);
                }
                n = n.normalize();
                if (BABYLON.Vector3.Dot(dir, n) > 0) {
                    n = n.scale(-1);
                }
                const r = dir.subtract(n.scale(2 * BABYLON.Vector3.Dot(dir, n))).normalize();
                queue.push({
                    origin: hit.pickedPoint.add(r.scale(EPS)),
                    dir: r,
                    color,
                    depth: depth + 1,
                    ignore: mesh,
                });
                continue;
            }

            // Sinon: blocker => stop.
        }

        // Désactiver les beams non utilisés.
        for (let i = beamIndex; i < this._laserBeamPool.length; i += 1) {
            this._laserBeamPool[i].root.setEnabled(false);
        }
    }

    setForceFieldEnabled(enabled) {
        if (enabled && !this.forceField) {
            this.forceField = BABYLON.MeshBuilder.CreateBox('forceField', {
                width: 1.2,
                height: 5,
                depth: 10,
            }, this.scene);
            this.forceField.position = new BABYLON.Vector3(52, 2.5, 0);

            const mat = new BABYLON.StandardMaterial('forceFieldMat', this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 1.0);
            mat.emissiveColor = new BABYLON.Color3(0.05, 0.25, 0.35);
            mat.alpha = 0.55;
            this.forceField.material = mat;

            this.forceFieldAgg = addStaticPhysics(this.forceField, 'BOX');
        }

        if (!enabled && this.forceField) {
            this.forceFieldAgg?.dispose();
            this.forceField.dispose();
            this.forceField = null;
            this.forceFieldAgg = null;
        }
    }

    updateJumpPad() {
        if (!this.jumpPad) return;

        this.jumpPadCooldown = Math.max(0, this.jumpPadCooldown - this.deltaTime);
        if (this.jumpPadCooldown > 0) return;

        const playerPos = this.player.player.position;
        const center = this.jumpPad.position;
        const distXZ = BABYLON.Vector2.Distance(
            new BABYLON.Vector2(playerPos.x, playerPos.z),
            new BABYLON.Vector2(center.x, center.z)
        );

        const closeToPad = distXZ < 1.35 && Math.abs(playerPos.y - center.y) < 1.6;
        if (closeToPad && this.player.isGrounded) {
            this.player.velocity.y = this.player.JUMP_FORCE * 1.75;
            this.player.isGrounded = false;
            this.player.groundDisableTimer = this.player.GROUND_DISABLE_TIME;
            this.jumpPadCooldown = 0.4;
        }
    }

    updateCheckpoints() {
        const p = this.player.player.position;

        const checkpointA = new BABYLON.Vector3(-5, 0, 0);
        if (BABYLON.Vector3.DistanceSquared(p, checkpointA) < 4) {
            this.player.respawnPos = new BABYLON.Vector3(-5, 1.2, 0);
        }

        const checkpointB = this.checkpointBPad.position;
        if (BABYLON.Vector3.DistanceSquared(p, checkpointB) < 4) {
            this.player.respawnPos = new BABYLON.Vector3(48, 1.2, 0);
            this.puzzleState.checkpointB = true;
        }
    }

    handleManualReset() {
        if (!this._keyJustPressed?.KeyR) return false;

        this.laserControl.active = null;
        this.updateLaserControlVisuals();

        // Reset orientations (émetteurs/miroirs).
        for (const e of this.emitters || []) {
            if (!e) continue;
            if (typeof e.initYaw === 'number') e.yaw = e.initYaw;
            if (typeof e.initPitch === 'number') e.pitch = e.initPitch;
        }
        for (const m of this.mirrors || []) {
            if (!m) continue;
            if (typeof m.initYaw === 'number') m.yaw = m.initYaw;
            if (typeof m.initPitch === 'number') m.pitch = m.initPitch;
        }
        for (const s of this.splitters || []) {
            if (!s) continue;
            if (typeof s.initYaw === 'number') s.yaw = s.initYaw;
        }
        this.applyLaserVisualRotations();

        // Reset puzzle state.
        if (this.puzzleState?.sensors) {
            for (const s of this.sensors || []) {
                this.puzzleState.sensors[s.id] = false;
            }
        }
        if (this.puzzleState?.charge) {
            this.puzzleState.charge.room5 = 0;
            this.puzzleState.charge.room8 = 0;
        }

        // Fermer portes.
        const q = BABYLON.Quaternion.Identity();
        for (const d of this.doors || []) {
            d.openUntil = 0;
            d.targetOpen = false;
            d.isOpen = false;
            d.currentPos = d.closedPos.clone();
            d.mesh.position.copyFrom(d.closedPos);
            try {
                d.aggregate?.body?.setTargetTransform(d.closedPos, d.mesh.rotationQuaternion || q);
            } catch {
                // noop
            }
        }

        // Reset capteur mobile.
        if (this._movingSensor?.mesh && this._movingSensorBasePos) {
            this._movingSensor.mesh.position.copyFrom(this._movingSensorBasePos);
        }

        // Reset miroir portable.
        if (this._portableMirror?.metadata?.boxAggregate) {
            if (this.player?.heldMesh === this._portableMirror) {
                this.player.heldMesh = null;
                this.player.isHoldingMesh = false;
            }

            this._portableMirror.metadata.snappedToStand = false;
            this._portableMirror.metadata.laserReflector = false;

            if (this._portableMirrorInitPos) {
                this._portableMirror.position.copyFrom(this._portableMirrorInitPos);
            }
            if (this._portableMirrorInitRot) {
                this._portableMirror.rotationQuaternion = this._portableMirrorInitRot.clone();
            }

            const agg = this._portableMirror.metadata.boxAggregate;
            try {
                agg.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                agg.body.setLinearVelocity(BABYLON.Vector3.Zero());
                agg.body.setAngularVelocity(BABYLON.Vector3.Zero());
                agg.body.setTargetTransform(this._portableMirror.position, this._portableMirror.rotationQuaternion || q);
            } catch {
                // noop
            }
        }

        // Couper les VFX.
        for (const b of this._laserBeamPool || []) {
            b.root.setEnabled(false);
        }

        this.player.respawn();
        return true;
    }

    resetCube(cube, spawnPos) {
        const agg = cube.metadata.boxAggregate;
        cube.position.copyFrom(spawnPos);
        agg.body.setLinearVelocity(BABYLON.Vector3.Zero());
        agg.body.setAngularVelocity(BABYLON.Vector3.Zero());

        if (this.player.heldMesh === cube) {
            this.player.heldMesh = null;
            this.player.isHoldingMesh = false;
        }
    }
}
