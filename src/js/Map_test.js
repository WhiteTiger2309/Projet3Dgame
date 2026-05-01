import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics } from './utils/utils.js';
import { createSciFiPanelTexture, createSciFiEmissiveLinesTexture, createPbrPanelMaterial, createEmissiveStripTexture } from './utils/materials.js';

export class MapTest extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        PLAYER_SPAWN_POS = new BABYLON.Vector3(-24, 2, 0);
        PLAYER_SPAWN_ROTATION = 1.57;
        
        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main);
        
        this.havokPlugin = main.havokPlugin
        this.puzzleState = {
            floorButton: false,
            heavyPlate: false,
            conductiveSocket: false,
            laserSensor: false,
            checkpointB: false,
        };

        this.triggerCounters = {
            heavyPlate: 0,
            conductiveSocket: 0,
        };

        this.jumpPadCooldown = 0;
        this.platformPhase = 0;
        this.platformEnabled = false;

        this.laserControl = {
            active: null,
            yawSpeed: 1.1,
            pitchSpeed: 0.8,
        };

        this.laserState = {
            emitterYaw: 0.43,
            emitterPitch: -0.06,
            mirrorYaw: Math.PI / 4,
            mirrorPitch: 0,
        };

        // this.createMap();
        this.registerCustomTriggerObserver();
    }

    createMap() {
        this.createGround(this.scene);
        this.createSkyAboveGround(this.scene);
        this.createBoundaryWalls(this.scene);
        this.createLightingAccent(this.scene);
        this.createPuzzleRooms(this.scene);
        this.createInteractiveObjects(this.scene);
        this.createPuzzleDevices(this.scene);
        this.createHintPanels(this.scene);
    }

    changeSceneBackground(scene) {
        scene.ambientColor = new BABYLON.Color3(0.20, 0.20, 0.24);
        scene.clearColor = new BABYLON.Color4(0.01, 0.02, 0.04, 1.0);
    }

    mapBeforeRenderUpdate() {
        this.updateLaserControls();
        this.updateMovingPlatform();
        this.updateLaserSystem();
        this.updateJumpPad();
        this.updateCheckpoints();
        this.handleManualReset();
        this.evaluatePuzzleLogic();
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

        material.setFloat("beamLength", length);
    }

    createGround(scene) {
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {
            width: 180,
            height: 90,
            subdivisions: 2,
        }, scene);

        // Test A/B: ground back to original asphalt image (no materials.js helpers).
        const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
        const asphalt = new BABYLON.Texture('/assets/terrain/asphalt_01.jpg', scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        asphalt.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        asphalt.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        asphalt.uScale = 10;
        asphalt.vScale = 5;
        asphalt.gammaSpace = true;
        asphalt.anisotropicFilteringLevel = 8;
        groundMat.diffuseTexture = asphalt;
        // Asphalt is matte; keep specular low to avoid shiny highlights.
        groundMat.specularColor = BABYLON.Color3.Black();
        ground.material = groundMat;

        addStaticPhysics(ground, 'BOX');

        // Thick fallback collider prevents character tunneling on thin surfaces.
        const groundCollider = BABYLON.MeshBuilder.CreateBox('groundCollider', {
            width: 180,
            depth: 90,
            height: 8,
        }, scene);
        groundCollider.position.y = -4;
        groundCollider.isVisible = false;
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
            textureUScale: 2,
            textureVScale: 1,
            metallic: 0.05,
            roughness: 0.9,
            emissiveColor: new BABYLON.Color3(0.0, 0.95, 1.0).scale(0.22),
            emissiveTexture: wallNeon,
        });

        const makeWall = (name, width, height, depth, position) => {
            const wall = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
            wall.position = position;
            wall.material = wallMat;
            addStaticPhysics(wall, 'BOX');
        };

        makeWall('northWall', 180, 10, 1, new BABYLON.Vector3(0, 5, 45));
        makeWall('southWall', 180, 10, 1, new BABYLON.Vector3(0, 5, -45));
        makeWall('westWall', 1, 10, 90, new BABYLON.Vector3(-90, 5, 0));
        makeWall('eastWall', 1, 10, 90, new BABYLON.Vector3(90, 5, 0));

        makeWall('sep1_left', 2, 10, 20, new BABYLON.Vector3(-10, 5, -35));
        makeWall('sep1_right', 2, 10, 20, new BABYLON.Vector3(-10, 5, 35));
        makeWall('sep2_left', 2, 10, 20, new BABYLON.Vector3(35, 5, -35));
        makeWall('sep2_right', 2, 10, 20, new BABYLON.Vector3(35, 5, 35));
    }

    createLightingAccent(scene) {
        const hemi = new BABYLON.HemisphericLight('hemiFill', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.35;

        const dir = new BABYLON.DirectionalLight('dirMain', new BABYLON.Vector3(-0.4, -1, 0.2), scene);
        dir.intensity = 0.8;
        dir.position = new BABYLON.Vector3(30, 60, -20);

        const chamberLight = (name, x, z, color) => {
            const l = new BABYLON.PointLight(name, new BABYLON.Vector3(x, 4.2, z), scene);
            l.diffuse = color;
            l.intensity = 3.5;
            l.range = 22;
        };

        chamberLight('chamberA_light', -45, 0, new BABYLON.Color3(0.2, 0.7, 1));
        chamberLight('chamberB_light', 10, 0, new BABYLON.Color3(0.3, 1, 0.6));
        chamberLight('chamberC_light', 65, 0, new BABYLON.Color3(1, 0.6, 0.2));
    }

    createPuzzleRooms(scene) {
        this.doorA = this.createSlidingDoor('doorA', new BABYLON.Vector3(-10, 2.5, 0), new BABYLON.Vector3(3, 5, 10));
        this.doorB = this.createSlidingDoor('doorB', new BABYLON.Vector3(35, 2.5, 0), new BABYLON.Vector3(3, 5, 10));
        this.finalDoor = this.createSlidingDoor('finalDoor', new BABYLON.Vector3(84, 2.5, 0), new BABYLON.Vector3(3, 5, 10));

        this.createCheckpointPad('checkpointA', new BABYLON.Vector3(-5, 0.08, 0), new BABYLON.Color3(0.3, 0.5, 1));
        this.checkpointBPad = this.createCheckpointPad('checkpointB', new BABYLON.Vector3(48, 0.08, 0), new BABYLON.Color3(0.3, 1, 0.5));

        this.createExitBeacon(scene);
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

        this.createLaserSystem(scene);
        this.createChamberBIndicators(scene);

        // Conditional moving platform
        this.createMovingPlatform(scene);

        // Force field blocks final chamber until doorB is solved
        this.setForceFieldEnabled(true);

        // Jump pad as alternative traversal mechanic
        this.createJumpPad(scene, new BABYLON.Vector3(18, 0.12, 8));
    }

    createHintPanels(scene) {
        this.createHintPanel(
            'hintA',
            new BABYLON.Vector3(-68, 3.4, 0),
            'CHAMBRE A - OBJECTIF: Ouvrir la porte A avec le bouton OU le cube lourd sur la plaque.'
        );
        this.createHintPanel(
            'hintB',
            new BABYLON.Vector3(2, 3.4, 0),
            'CHAMBRE B - OBJECTIF: Ouvrir doorB avec 2 conditions: (1) LASER sur capteur ET (2) cube conducteur sur SOCKET.'
        );
        this.createHintPanel(
            'hintC',
            new BABYLON.Vector3(58, 3.4, 0),
            'CHAMBRE C - OBJECTIF: Activer checkpoint B. La porte finale s ouvre si A + B + checkpoint B sont valides.'
        );
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
            // Higher resolution + pixel-based outline => very thin contour even on large meshes.
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
            // Boost emissive above 1.0 so bloom actually triggers.
            emissiveColor: new BABYLON.Color3(0.0, 0.9, 1.0).scale(2.25),
            emissiveTexture: doorEmissive,
        });
        door.material = mat;
        door.position = position.clone();

        const agg = addStaticPhysics(door, 'BOX');
        agg.body.disablePreStep = false;

        return {
            mesh: door,
            aggregate: agg,
            closedPos: position.clone(),
            openPos: position.clone().add(new BABYLON.Vector3(0, 5.4, 0)),
            isOpen: false,
        };
    }

    setDoorState(doorObj, shouldOpen) {
        if (doorObj.isOpen === shouldOpen) return;
        doorObj.mesh.position.copyFrom(shouldOpen ? doorObj.openPos : doorObj.closedPos);
        doorObj.isOpen = shouldOpen;
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
        this.laserEmitter = BABYLON.MeshBuilder.CreateCylinder('laserEmitter', {
            diameter: 0.8,
            height: 2,
            tessellation: 12,
        }, scene);
        this.laserEmitter.position = new BABYLON.Vector3(0, 1.2, -8);
        this.applyLaserVisualRotations();

        const emitterEmissive = createEmissiveStripTexture(scene, 'laserEmitter_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: new BABYLON.Color3(1.0, 0.25, 0.15),
            intensity: 1.2,
        });
        const emitterMat = createPbrPanelMaterial(scene, 'laserEmitterMat', {
            baseColor: new BABYLON.Color3(0.22, 0.22, 0.24),
            metallic: 0.12,
            roughness: 0.65,
            emissiveColor: new BABYLON.Color3(1.0, 0.25, 0.15).scale(2.0),
            emissiveTexture: emitterEmissive,
        });
        this.laserEmitterBaseEmissive = emitterMat.emissiveColor.clone();
        this.laserEmitter.material = emitterMat;
        const emitterAgg = addStaticPhysics(this.laserEmitter, 'BOX');
        emitterAgg.body.disablePreStep = true;
        this.laserEmitter.metadata = {
            isInteractable: true,
            onInteract: () => this.toggleLaserControl('emitter'),
        };

        this.laserMirror = BABYLON.MeshBuilder.CreateBox('laserMirror', {
            width: 0.25,
            height: 2.5,
            depth: 4,
        }, scene);
        this.laserMirror.position = new BABYLON.Vector3(12, 1.3, -2.5);
        this.laserMirror.rotation.y = this.laserState.mirrorYaw;
        this.laserMirror.rotation.x = this.laserState.mirrorPitch;

        const mirrorEmissive = createEmissiveStripTexture(scene, 'laserMirror_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: new BABYLON.Color3(0.0, 0.95, 1.0),
            intensity: 1.1,
        });
        const mirrorMat = createPbrPanelMaterial(scene, 'laserMirrorMat', {
            baseColor: new BABYLON.Color3(0.55, 0.65, 0.8),
            metallic: 0.35,
            roughness: 0.25,
            emissiveColor: new BABYLON.Color3(0.0, 0.95, 1.0).scale(1.85),
            emissiveTexture: mirrorEmissive,
        });
        this.laserMirrorBaseEmissive = mirrorMat.emissiveColor.clone();
        this.laserMirror.material = mirrorMat;
        const mirrorAgg = addStaticPhysics(this.laserMirror, 'BOX');
        mirrorAgg.body.disablePreStep = true;
        this.laserMirror.metadata = {
            isInteractable: true,
            onInteract: () => this.toggleLaserControl('mirror'),
        };

        this.laserSensor = BABYLON.MeshBuilder.CreateCylinder('laserSensor', {
            diameter: 1.4,
            height: 0.5,
            tessellation: 16,
        }, scene);
        this.laserSensor.position = new BABYLON.Vector3(26, 1.0, -2.5);
        this.laserSensor.rotation.x = Math.PI / 2;

        const sensorEmissive = createEmissiveStripTexture(scene, 'laserSensor_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: new BABYLON.Color3(0.9, 0.35, 0.12),
            intensity: 1.0,
        });
        this.laserSensorMat = createPbrPanelMaterial(scene, 'laserSensorMat', {
            baseColor: new BABYLON.Color3(0.14, 0.16, 0.20),
            metallic: 0.08,
            roughness: 0.85,
            emissiveColor: new BABYLON.Color3(0.9, 0.35, 0.12).scale(1.85),
            emissiveTexture: sensorEmissive,
        });
        this.laserSensor.material = this.laserSensorMat;
        addStaticPhysics(this.laserSensor, 'BOX');

        // Shader-based laser beams (animated, additive) for a more "energy" look.
        this.ensureLaserBeamShaders();

        this._laserTime = 0;

        this.laserBeamMatA = new BABYLON.ShaderMaterial(
            "laserBeamMatA",
            scene,
            { vertex: "laserBeam", fragment: "laserBeam" },
            {
                attributes: ["position", "uv"],
                uniforms: ["worldViewProjection", "time", "beamLength", "intensity", "beamColor"],
                needAlphaBlending: true,
            }
        );
        this.laserBeamMatA.backFaceCulling = false;
        this.laserBeamMatA.alphaMode = BABYLON.Engine.ALPHA_ADD;
        this.laserBeamMatA.disableDepthWrite = true;
        this.laserBeamMatA.setColor3("beamColor", new BABYLON.Color3(1.0, 0.25, 0.15));
        this.laserBeamMatA.setFloat("intensity", 1.35);
        this.laserBeamMatA.setFloat("beamLength", 1);
        this.laserBeamMatA.setFloat("time", 0);

        this.laserBeamMatB = new BABYLON.ShaderMaterial(
            "laserBeamMatB",
            scene,
            { vertex: "laserBeam", fragment: "laserBeam" },
            {
                attributes: ["position", "uv"],
                uniforms: ["worldViewProjection", "time", "beamLength", "intensity", "beamColor"],
                needAlphaBlending: true,
            }
        );
        this.laserBeamMatB.backFaceCulling = false;
        this.laserBeamMatB.alphaMode = BABYLON.Engine.ALPHA_ADD;
        this.laserBeamMatB.disableDepthWrite = true;
        this.laserBeamMatB.setColor3("beamColor", new BABYLON.Color3(1.0, 0.55, 0.2));
        this.laserBeamMatB.setFloat("intensity", 1.15);
        this.laserBeamMatB.setFloat("beamLength", 1);
        this.laserBeamMatB.setFloat("time", 0);

        this.laserBeamA = this.createLaserBeamCross(scene, "laserBeamA", this.laserBeamMatA, { width: 0.065 });
        this.laserBeamB = this.createLaserBeamCross(scene, "laserBeamB", this.laserBeamMatB, { width: 0.055 });
    }

    toggleLaserControl(target) {
        if (this.laserControl.active === target) {
            this.laserControl.active = null;
        } else {
            this.laserControl.active = target;
        }
        this.updateLaserControlVisuals();
    }

    updateLaserControlVisuals() {
        const emitterMat = this.laserEmitter?.material;
        const mirrorMat = this.laserMirror?.material;
        if (!emitterMat || !mirrorMat) return;

        emitterMat.emissiveColor = this.laserControl.active === 'emitter'
            ? new BABYLON.Color3(2.2, 1.1, 0.35)
            : this.laserEmitterBaseEmissive.clone();

        mirrorMat.emissiveColor = this.laserControl.active === 'mirror'
            ? new BABYLON.Color3(0.55, 2.2, 2.6)
            : this.laserMirrorBaseEmissive.clone();
    }

    updateLaserControls() {
        if (!this.laserEmitter || !this.laserMirror) return;

        if (this.player.input.justPressed['KeyT'] || this.player.input.justPressed['Escape']) {
            this.laserControl.active = null;
            this.updateLaserControlVisuals();
        }

        if (!this.laserControl.active) return;

        const inputMap = this.player.input.inputMap;
        const dt = this.deltaTime;
        let yawDelta = 0;
        let pitchDelta = 0;

        const keyDown = (...codes) => codes.some((c) => !!inputMap[c]);

        if (keyDown('KeyJ', 'ArrowLeft', 'Numpad4')) yawDelta += this.laserControl.yawSpeed * dt;
        if (keyDown('KeyL', 'ArrowRight', 'Numpad6')) yawDelta -= this.laserControl.yawSpeed * dt;
        if (keyDown('KeyI', 'ArrowUp', 'Numpad8')) pitchDelta += this.laserControl.pitchSpeed * dt;
        if (keyDown('KeyK', 'ArrowDown', 'Numpad5')) pitchDelta -= this.laserControl.pitchSpeed * dt;

        if (this.laserControl.active === 'emitter') {
            this.laserState.emitterYaw += yawDelta;
            this.laserState.emitterPitch = BABYLON.Scalar.Clamp(
                this.laserState.emitterPitch + pitchDelta,
                -1.0,
                1.0
            );
        } else if (this.laserControl.active === 'mirror') {
            this.laserState.mirrorYaw += yawDelta;
            this.laserState.mirrorPitch = BABYLON.Scalar.Clamp(
                this.laserState.mirrorPitch + pitchDelta,
                -0.45,
                0.45
            );
        }

        this.applyLaserVisualRotations();
    }

    applyLaserVisualRotations() {
        if (this.laserEmitter) {
            this.laserEmitter.rotation.x = -this.laserState.emitterPitch;
            this.laserEmitter.rotation.y = this.laserState.emitterYaw;
            this.laserEmitter.rotation.z = Math.PI / 2;
        }

        if (this.laserMirror) {
            this.laserMirror.rotation.y = this.laserState.mirrorYaw;
            this.laserMirror.rotation.x = this.laserState.mirrorPitch;
        }
    }

    getDirectionFromYawPitch(yaw, pitch) {
        const cp = Math.cos(pitch);
        return new BABYLON.Vector3(
            cp * Math.cos(yaw),
            Math.sin(pitch),
            cp * Math.sin(yaw)
        ).normalize();
    }

    createMovingPlatform(scene) {
        this.movingPlatform = BABYLON.MeshBuilder.CreateBox('movingPlatform', {
            width: 5,
            height: 0.8,
            depth: 5,
        }, scene);
        this.movingPlatform.position = new BABYLON.Vector3(28, 1.5, 8);

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
        const doorAOpen = this.puzzleState.floorButton || this.puzzleState.heavyPlate;
        const doorBOpen = this.puzzleState.conductiveSocket && this.puzzleState.laserSensor;
        const finalDoorOpen = doorAOpen && doorBOpen && this.puzzleState.checkpointB;

        this.setDoorState(this.doorA, doorAOpen);
        this.setDoorState(this.doorB, doorBOpen);
        this.setDoorState(this.finalDoor, finalDoorOpen);

        this.platformEnabled = doorAOpen;
        this.setForceFieldEnabled(!doorBOpen);

        this.laserSensorMat.emissiveColor = this.puzzleState.laserSensor
            ? new BABYLON.Color3(0.1, 0.9, 0.3)
            : new BABYLON.Color3(0.06, 0.06, 0.08);

        if (this.indicatorLaserMat && this.indicatorSocketMat) {
            const offColor = new BABYLON.Color3(0.35, 0.08, 0.08);
            const onColor = new BABYLON.Color3(0.12, 0.95, 0.22);

            this.indicatorLaserMat.diffuseColor = this.puzzleState.laserSensor ? onColor : offColor;
            this.indicatorLaserMat.emissiveColor = this.puzzleState.laserSensor ? onColor.scale(0.7) : offColor.scale(0.3);

            this.indicatorSocketMat.diffuseColor = this.puzzleState.conductiveSocket ? onColor : offColor;
            this.indicatorSocketMat.emissiveColor = this.puzzleState.conductiveSocket ? onColor.scale(0.7) : offColor.scale(0.3);
        }

        this.exitBeaconMat.emissiveColor = finalDoorOpen
            ? new BABYLON.Color3(0.2, 1.0, 0.35)
            : new BABYLON.Color3(0.12, 0.05, 0.01);
    }

    updateMovingPlatform() {
        if (!this.platformAggregate) return;

        if (this.platformEnabled) {
            this.platformPhase += this.deltaTime * 1.25;
        }

        const yOffset = this.platformEnabled ? Math.sin(this.platformPhase) * 4.0 : 0;
        const targetPos = this.platformBasePos.add(new BABYLON.Vector3(0, yOffset, 0));

        this.platformAggregate.body.setTargetTransform(
            targetPos,
            this.movingPlatform.rotationQuaternion || BABYLON.Quaternion.Identity()
        );
    }

    updateLaserSystem() {
        // Animate shader time.
        if (this.laserBeamMatA && this.laserBeamMatB) {
            this._laserTime = (this._laserTime || 0) + (this.deltaTime || 0);
            this.laserBeamMatA.setFloat("time", this._laserTime);
            this.laserBeamMatB.setFloat("time", this._laserTime);
        }

        const dir = this.getDirectionFromYawPitch(this.laserState.emitterYaw, this.laserState.emitterPitch);
        const start = this.laserEmitter.getAbsolutePosition().add(dir.scale(0.8));

        const rayA = new BABYLON.Ray(start, dir, 80);
        const hitA = this.scene.pickWithRay(rayA, (m) => m === this.laserMirror || m === this.laserSensor || m.name === 'northWall' || m.name === 'southWall' || m.name === 'sep2_left' || m.name === 'sep2_right');

        const endA = hitA?.hit ? hitA.pickedPoint : start.add(dir.scale(80));
        if (this.laserBeamA && this.laserBeamMatA) {
            this.setLaserBeamSegment(this.laserBeamA, this.laserBeamMatA, start, endA);
        }

        let sensorActive = hitA?.pickedMesh === this.laserSensor;

        if (hitA?.pickedMesh === this.laserMirror && hitA.getNormal(true)) {
            const normal = hitA.getNormal(true).normalize();
            const reflected = dir.subtract(normal.scale(2 * BABYLON.Vector3.Dot(dir, normal))).normalize();
            const startB = endA.add(reflected.scale(0.06));
            const rayB = new BABYLON.Ray(startB, reflected, 80);
            const hitB = this.scene.pickWithRay(rayB, (m) => m === this.laserSensor || m.name === 'northWall' || m.name === 'southWall' || m.name === 'eastWall');
            const endB = hitB?.hit ? hitB.pickedPoint : startB.add(reflected.scale(80));

            if (this.laserBeamB && this.laserBeamMatB) {
                this.setLaserBeamSegment(this.laserBeamB, this.laserBeamMatB, startB, endB);
            }

            sensorActive = sensorActive || hitB?.pickedMesh === this.laserSensor;
        } else {
            if (this.laserBeamB) {
                this.laserBeamB.root.setEnabled(false);
            }
        }

        this.puzzleState.laserSensor = !!sensorActive;
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
        if (!this.player.input.justPressed['KeyR']) return;

        this.resetCube(this.heavyCube, this.cubeSpawns.heavy);
        this.resetCube(this.conductiveCube, this.cubeSpawns.conductive);

        this.puzzleState.floorButton = false;
        this.puzzleState.heavyPlate = false;
        this.puzzleState.conductiveSocket = false;
        this.puzzleState.laserSensor = false;
        this.puzzleState.checkpointB = false;

        this.triggerCounters.heavyPlate = 0;
        this.triggerCounters.conductiveSocket = 0;
        this.platformPhase = 0;

        this.setDoorState(this.doorA, false);
        this.setDoorState(this.doorB, false);
        this.setDoorState(this.finalDoor, false);
        this.setForceFieldEnabled(true);

        this.player.respawnPos = new BABYLON.Vector3(-24, 2, 0);
        this.player.respawn();
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
