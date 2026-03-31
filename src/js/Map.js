import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate } from './utils/utils.js';
import { Robot } from './Robot.js';
import { Map2 } from './Map2.js';

export class Map extends CreateMap {
    constructor(canvas, engine, havokPlugin, main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 4.5, 1)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 4.3
        }

        super(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

        this.createMap()

    }

    createMap() {
        this.createGround(this.scene);
        this.createSkyAboveGround(this.scene);
        this.createShip(this.scene)
        this.createPuzzleMap()
        new Robot(this.main, new BABYLON.Vector3(0, 0, 10), 1.4)
        this.createBox(new BABYLON.Vector3(-11, 0.7, 0))
        createMapChangeGate(this.main, Map2, new BABYLON.Vector3(0, 0, -10), new BABYLON.Vector3(0, 2, 0), BABYLON.Tools.ToRadians(180))
    }

    mapBeforeRenderUpdate() {

    }

    createGround(scene) {
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 250, height: 250, subdivisions: 2 }, scene);
        ground.material = this.main.materials["ground"];
        addStaticPhysics(ground, "BOX");
    }

    createPuzzleMap() {
        const instances = this.main.assets["testMap"].instantiateModelsToScene((name) => name);
        const map = instances.rootNodes[0];
        map.position.x = -10
        map.getDescendants().forEach(mesh => {
            if (mesh.metadata?.gltf?.extras.collisions) {
                mesh.metadata.aggregate = addStaticPhysics(mesh, "MESH")
            }
            mesh.metadata.aggregate = addStaticPhysics(mesh, "MESH")
        })
    }

    createShip(scene) {
        const instances = this.main.assets["ship"].instantiateModelsToScene((name) => name);
        const ship = instances.rootNodes[0];
        ship.getDescendants().forEach(mesh => {
            if (mesh.metadata?.gltf?.extras.collisions) {
                mesh.metadata.aggregate = addStaticPhysics(mesh, "MESH")
            }
        })
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