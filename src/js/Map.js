import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createButton, addTriggerObservable, createMapChangeGate } from './utils/utils.js';

import { Map2 } from './Map2.js';

export class Map extends CreateMap {
    constructor(canvas, engine, havokPlugin, main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 4.5, 1)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 4.3
        }
        // const PLAYER_SPAWN_POS = new BABYLON.Vector3(3.89, 1, 1)
        // const PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 4.5, 1)
        // const PLAYER_SPAWN_ROTATION = new BABYLON.Vector3(0, 4.3, 0)
        // const PLAYER_SPAWN_POS = new BABYLON.Vector3(-1.6, 1, 10)
        // const PLAYER_SPAWN_ROTATION = new BABYLON.Vector3(0, 1.5, 0)

        super(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

        this.createMap()

    }

    createMap() {
        this.createGround(this.scene);
        this.createSkyAboveGround(this.scene);
        this.createShip(this.scene)
        this.createPuzzleMap()
        this.addRobot()
        this.createBox(new BABYLON.Vector3(-11, 0.7, 0))
        createMapChangeGate(Map2,new BABYLON.Vector3(0, 0, -10), new BABYLON.Vector3(0, 3, -10), BABYLON.Tools.ToRadians(180))
        addTriggerObservable(this.havokPlugin, this.main)
    }

    mapBeforeRenderUpdate() {

    }

    createGround(scene) {
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 250, height: 250, subdivisions: 2 }, scene);
        this.addGroundTexture(ground)
        addStaticPhysics(ground, "BOX");
    }

    createPuzzleMap() {
        BABYLON.ImportMeshAsync("models/testMap.glb").then((result) => {
            const map = result.meshes[0];
            map.position.x = -10
            result.meshes.forEach(mesh => {
                if (mesh.metadata?.gltf?.extras.collisions) {
                    mesh.metadata.aggregate = addStaticPhysics(mesh, "MESH")
                }
            });
        });
    }

    addRobot() {
        BABYLON.ImportMeshAsync("models/robot.glb").then((result) => {
            const robot = result.meshes[0];
            robot.position.z = 10
            robot.rotationQuaternion = null
            robot.rotation.y = 1.4
            result.meshes.forEach(mesh => {
                if (mesh.metadata?.gltf?.extras.collisions) {
                    mesh.metadata.aggregate = addStaticPhysics(mesh, "CONVEX_HULL")
                }
            });
            // const RobotFaceIdle = this.scene.getAnimationGroupByName("RobotFaceIdle")
            // RobotFaceIdle.stop()
            // // const RobotTalking = this.scene.getAnimationGroupByName("RobotFaceTalking")
            // // RobotTalking.start(true)
            const RobotIdle = this.scene.getAnimationGroupByName("RobotIdle")
            RobotIdle.start(true)
            // console.log(this.scene.animationGroups)

            // console.log(result)
            // result.transformNodes[5]._children[0]._rotationQuaternion.y = 0.5
            // console.log(result.transformNodes[5]._children[0])
        });
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
            canBeHeld: true,
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
        sky.material = skyMat;
    }

    addGroundTexture = (ground) => {
        const mat = new BABYLON.StandardMaterial("groundMat", this.scene);
        mat.diffuseTexture = new BABYLON.Texture("/assets/terrain/asphalt_01.jpg", this.scene);
        mat.diffuseTexture.uScale = 28;
        mat.diffuseTexture.vScale = 28;
        mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
        mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
        ground.material = mat;
    }

}