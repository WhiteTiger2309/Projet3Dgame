import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createButton, addTriggerObservable } from './utils/utils.js';
import { createMetalFloorTexture, createPbrPanelMaterial } from './utils/materials.js';

export class Map extends CreateMap {
    constructor(canvas, engine, havokPlugin) {
        const PLAYER_SPAWN_POS = new BABYLON.Vector3(3.89, 1, 1)
        const PLAYER_SPAWN_ROTATION = new BABYLON.Vector3(0, 4.3, 0)

        super(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)

        this.createMap()

        super.startRender()
    }

    createMap() {
        this.createGround(this.scene);
        this.createSkyAboveGround(this.scene);
        this.createShip(this.scene)
        this.createBox(new BABYLON.Vector3(-2.28, 1.7, -1.6))
    }

    // changeSceneBackground(scene) {
    //     scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);
    //     scene.clearColor = new BABYLON.Color4(0.02, 0.1, 0.1, 0.5);
    // }

    mapBeforeRenderUpdate() {

    }

    createGround(scene) {
        const ground = BABYLON.MeshBuilder.CreateGround(
            "ground",
            { width: 250, height: 250, subdivisions: 2 },
            scene
        );

        const groundTex = createMetalFloorTexture(scene, "metalFloor_dt_map", {
            size: 1024,
            panel: 192,
            seamAlpha: 0.22,
            grooveAlpha: 0.14,
            microNoiseAlpha: 0.05,
        });
        const mat = createPbrPanelMaterial(scene, 'groundMat', {
            baseColor: new BABYLON.Color3(0.72, 0.74, 0.78),
            texture: groundTex,
            textureUScale: 8,
            textureVScale: 8,
            metallic: 0.03,
            roughness: 0.96,
            environmentIntensity: 0.18,
        });
        ground.material = mat;

        addStaticPhysics(ground, "BOX")

        // return ground;
    }

    createShip(scene) {
        BABYLON.ImportMeshAsync("models/shipTest.glb").then((result) => {
            // let ship = result.meshes[0]
            result.meshes.forEach(mesh => {
                // console.log(mesh.name)
                if (mesh.metadata?.gltf?.extras.collisions) {
                    mesh.metadata.aggregate = addStaticPhysics(mesh, "MESH")
                }
            });

            const door = scene.getMeshByName("Door");
            door.metadata.defaultPos = door.position.clone();
            door.metadata.isOpen = false;
            door.metadata.aggregate.body.disablePreStep = false;

            const buttonPressedAnimation = scene.getAnimationGroupByName("InsideButtonPressed")
            buttonPressedAnimation.stop()

            const insideButton = scene.getMeshByName("InsideButton")
            insideButton.metadata = {
                isInteractable: true,
                onInteract: () => {
                    if (!buttonPressedAnimation.isPlaying) {
                        buttonPressedAnimation.play();
                        this.toggleShipDoor(door);
                    }
                }
            }
            // const InsideButton2 = insideButton.clone("InsideButton2")
            // InsideButton2.position.x = 3
            // InsideButton2.rotationQuaternion = null
            // InsideButton2.rotation.y = 1.57
        });
    }

    toggleShipDoor(door) {
        if (door.metadata.isOpen) {
            console.log("close");
            door.position = door.metadata.defaultPos;
        }
        else {
            console.log("open");
            door.position = door.metadata.defaultPos.clone().addInPlace(new BABYLON.Vector3(0, 2, 0));
        }
        door.metadata.isOpen = !door.metadata.isOpen;
    }

    createBox(pos) {
        this.box = BABYLON.MeshBuilder.CreateBox("box", { width: 1, depth: 1, height: 1 }, this.scene);
        this.box.material = new BABYLON.StandardMaterial("boxMat", this.scene);
        this.box.position = pos;
        const boxAggregate = new BABYLON.PhysicsAggregate(this.box, BABYLON.PhysicsShapeType.BOX, { mass: 50.25, friction: 0.75, restitution: 0 }, this.scene);
        this.box.metadata = {
            boxAggregate: boxAggregate,
            isInteractable: true,
            onInteract: () => {
                if (!this.player.heldMesh) {
                    this.player.heldMesh = this.box;
                }
            }
        };
    }



    createSkyAboveGround(scene) {
        const sky = BABYLON.MeshBuilder.CreateSphere(
            "spaceSkyAbove",
            { diameter: 900, segments: 48, slice: 0.5, sideOrientation: BABYLON.Mesh.BACKSIDE },
            scene
        );
        sky.position = new BABYLON.Vector3(0, -20, 0);
        sky.isPickable = false;

        const skyMat = new BABYLON.StandardMaterial("spaceSkyAboveMat", scene);
        skyMat.diffuseTexture = new BABYLON.Texture("/assets/space/space1.png", scene);
        skyMat.diffuseTexture.uScale = 1;
        skyMat.diffuseTexture.vScale = 1;
        skyMat.emissiveTexture = skyMat.diffuseTexture;
        skyMat.disableLighting = true;
        skyMat.backFaceCulling = false;
        skyMat.fogEnabled = false;
        sky.material = skyMat;
    }

}