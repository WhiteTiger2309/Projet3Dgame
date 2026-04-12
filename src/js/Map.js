import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox, createButton, openDoor, closeDoor, createDoor, createAntiBoxGate } from './utils/utils.js';
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

        this.createOldPuzzleMap(placeOnGround(this.ground, -20, -80))
        this.createCave(placeOnGround(this.ground, 5, -20))
        this.createRuins(placeOnGround(this.ground, -10, 20))
        this.createStructure(placeOnGround(this.ground, 250, -80))
        new Robot(this.main, placeOnGround(this.ground, 0, 10), 1.4)
        createMapChangeGate(this.main, Map2, new BABYLON.Vector3(232, 20, -80), new BABYLON.Vector3(0, 2, 0), BABYLON.Tools.ToRadians(90))


        this.electricPuzzle = new ElectricPuzzle(this.main, new BABYLON.Vector3(10, 1, 10))
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
                    ground.material = this.main.materials["ground2"];
                    addStaticPhysics(ground, "MESH");
                    ground.updateCoordinateHeights()

                    resolve(ground);
                }
            }, scene);
        })
    }

    createPuzzleMap(pos) {
        const level = `
        .H.H.H.W...E.H.H.H.
        N.................V
        ...................
        V.................V
        ...................
        V.................N
        ...E.H.H.H.W.......
        N...........V.....V
        ...................
        S...........V.....S
        .H.H.H.H.W...E.H.H.
        ........V.....V....
        ...................
        ........V.....V....
        ...................
        ........S.....S....
        .........W...E.....
        `;
        const tileMap = {
            ".": null,
            "V": { type: "wall", rot: 0 },
            "H": { type: "wall", rot: 90 },
            "D": { type: "doorway", rot: 90 },
            "N": { type: "wallPillar", rot: 0 },
            "S": { type: "wallPillar", rot: 180 },
            "E": { type: "wallPillar", rot: 270 },
            "W": { type: "wallPillar", rot: 90 },
        };
        const rows = level.trim().split("\n").map(row => row.trim());

        const defaultPos = pos.clone()
        defaultPos.z = defaultPos.z - (rows[0].length * 2.5) / 2
        defaultPos.x = defaultPos.x - rows.length * 2.5

        for (let i = 0; i < rows.length; i++) {
            for (let j = 0; j < rows[i].length; j++) {
                const char = rows[i][j];
                const tile = tileMap[char];
                if (!tile) continue;
                createMeshFromAsset(this.main.assets[tile.type], new BABYLON.Vector3(i * 2.5 + defaultPos.x, 0, j * 2.5 + defaultPos.z), "BOX", tile.rot ? BABYLON.Tools.ToRadians(tile.rot) : 0);
            }
        }

        // level 1
        createBox(this.main, new BABYLON.Vector3(-32, 1, -1))
        const door1 = createDoor(this.main, new BABYLON.Vector3(-37.5, 0, 4), 90)
        createButton(this.main, new BABYLON.Vector3(-28, 1, 8), () => openDoor(door1, "x"), () => closeDoor(door1, "x"))
        
        // level 2 nul
        createBox(this.main, new BABYLON.Vector3(-39.2, 1, -2.1))
        const obstacle = BABYLON.MeshBuilder.CreateBox("obstacle", { width: 5, depth: 3, height: 2 }, this.scene);
        obstacle.position = new BABYLON.Vector3(-44.5, 1, -4)
        addStaticPhysics(obstacle, "BOX")
        createAntiBoxGate(this.main, new BABYLON.Vector3(-39.5, -2.5, -3.8), 0)

        createAntiBoxGate(this.main, new BABYLON.Vector3(-47.5, 0, -21.5), 90)
        
    }

    createOldPuzzleMap(pos) {
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
        createMeshFromAsset(this.main.assets["ship"], pos, "MESH", undefined, false)

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