import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime } from './utils/utils.js';
import { Robot } from './Robot.js';
import { ElectricPuzzle } from './ElectricPuzzle.js';
import { Map2 } from './Map2.js';

export class Map extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 4.5, 1)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 246
        }
        PLAYER_SPAWN_ROTATION = BABYLON.Tools.ToRadians(PLAYER_SPAWN_ROTATION)

        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)
    }

    async createMap() {
        await this.createGround(this.scene);
        this.createSkyAboveGround(this.scene);
        this.createShip(placeOnGround(this.ground, 0, 0))
        this.createPuzzleMap(placeOnGround(this.ground, -20, 0))
        this.createCave(placeOnGround(this.ground, 5, -20))
        this.createRuins(placeOnGround(this.ground, -10, 20))
        this.createStructure(placeOnGround(this.ground, 250, -80))
        new Robot(this.main, placeOnGround(this.ground, 0, 10), 1.4)
        this.createBox(new BABYLON.Vector3(-21, 0.7, 0))
        createMapChangeGate(this.main, Map2, new BABYLON.Vector3(232, 20, -80), new BABYLON.Vector3(0, 2, 0), BABYLON.Tools.ToRadians(90))
        
        this.electricPuzzle =  new ElectricPuzzle(this.main, new BABYLON.Vector3(-10, 1, 10))
    }

    mapBeforeRenderUpdate() {
        this.electricPuzzle.updateElectricity() 
    }

    createGround(scene) {
        return new Promise((resolve) => {
            this.ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("ground", 'images/hmap.jpeg', {
                width: 850,
                height: 850,
                subdivisions: 25,
                minHeight: -40,
                maxHeight: 50,
                onReady: (ground) => {
                    ground.material = this.main.materials["ground"];
                    addStaticPhysics(ground, "MESH");
                    ground.updateCoordinateHeights()

                    resolve(ground);
                }
            }, scene);
            const pos = new BABYLON.Vector3(0, 0, 10)
        })
    }

    createPuzzleMap(pos) {
        createMeshFromAsset(this.main.assets["puzzleMap1"], pos, "MESH")
    }

    createRuins(pos) {
        const defPos = pos.clone()
        for (let i = 1; i <= 5; i++) {
            pos.x = defPos.x + i * 2
            createMeshFromAsset(this.main.assets["ruins" + i], pos, "CONVEX_HULL")
        }
        pos = defPos
        pos.x += 5
        pos.z += 2
        createMeshFromAsset(this.main.assets["ruinsPuzzleMap"], pos, "MESH")
        createBounceSlime(this.main, new BABYLON.Vector3(-21, 6, 37))
        createBounceSlime(this.main, new BABYLON.Vector3(3, 6, 81))
        createBounceSlime(this.main, new BABYLON.Vector3(-7, 6, 82))
    }

    createCave(pos) {
        createMeshFromAsset(this.main.assets["cave"], pos, "MESH")
    }

    createStructure(pos) {
        createMeshFromAsset(this.main.assets["structure"], pos, "MESH")
    }


    createShip(pos) {
        createMeshFromAsset(this.main.assets["ship"], pos, "MESH", false)

        const door = this.scene.getMeshByName("Door");
        door.metadata.defaultPos = door.position.clone();
        door.metadata.isOpen = false;
        door.metadata.aggregate.body.disablePreStep = false;

        const buttonPressedAnimation = this.scene.getAnimationGroupByName("InsideButtonPressed")
        buttonPressedAnimation.stop()

        const insideButton = this.scene.getMeshByName("InsideButton")
        insideButton.metadata = {
            isInteractable: true,
            onInteract: () => {
                if (!buttonPressedAnimation.isPlaying) {
                    buttonPressedAnimation.play();
                    this.toggleShipDoor(door);
                }
            }
        }
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
        sky.material = this.main.materials["spaceSkyAbove"];
    }

}