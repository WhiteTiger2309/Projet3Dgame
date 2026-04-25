import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox, createAntiBoxGate, placeOnMesh, createGrabbableObject } from './utils/utils.js';
import { Map } from './Map.js';
import { MapLab } from './MapLab.js';

export class MapStart extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(28.0, 1.9, -6.6)
            // PLAYER_SPAWN_POS = new BABYLON.Vector3(32.4, 7.8, 38.2)
            // PLAYER_SPAWN_POS = new BABYLON.Vector3(33.9, 10.9, 38.6)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 177
        }
        PLAYER_SPAWN_ROTATION = BABYLON.Tools.ToRadians(PLAYER_SPAWN_ROTATION)

        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

    }

    async createMap() {
        await this.createLandscapeGround(this.scene);
        this.createTerrain(new BABYLON.Vector3(30, 1, 20));
        this.createDoors(new BABYLON.Vector3(30, 1, 20));
        this.createCard(new BABYLON.Vector3(37.8, 3, -17.2))

        this.createShip(placeOnMesh(this.main, new BABYLON.Vector3(35.4, 7.7, 40.3)), BABYLON.Tools.ToRadians(90))
        createMapChangeGate(this.main, MapLab, new BABYLON.Vector3(29, 0, -20.8), undefined, BABYLON.Tools.ToRadians(180))
    }

    mapBeforeRenderUpdate() {

    }

    createTerrain(pos) {
        const ground = createMeshFromAsset(this.main.assets["terrain"], pos, "MESH")
        ground.getDescendants().forEach(mesh => {
            if (mesh.name == "cardReaderTrigger") {
                mesh.isVisible = false;
                mesh.metadata.aggregate.shape.isTrigger = true;
            }
        })
    }

    createDoors(pos) {
        const doors = createMeshFromAsset(this.main.assets["doors"], pos, "MESH")
        doors.getDescendants().forEach(door => {
            door.metadata.aggregate.body.disablePreStep = false;
        })
        const doorsOpen = this.scene.getAnimationGroupByName("DoorOpening")
        doorsOpen.stop();
        // doorsOpen.play();
    }

    createCard(pos) {
        const card = createMeshFromAsset(this.main.assets["accesCard"], pos, "BOX", undefined, false).getDescendants()[0]
        createGrabbableObject(this.main, pos, card)
    }


    createLandscapeGround(scene) {
        return new Promise((resolve) => {
            this.ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("ground", 'images/hmap2.jpg', {
                width: 2000,
                height: 2000,
                subdivisions: 50,
                minHeight: -42,
                maxHeight: 20,
                onReady: (ground) => {
                    // ground.material = this.main.materials["ground2_2"];
                    ground.material = this.main.materials["snow"];
                    // addStaticPhysics(ground, "MESH");
                    // ground.updateCoordinateHeights()

                    resolve(ground);
                }
            }, scene);
        })
    }

    createShip(pos, rotation) {
        createMeshFromAsset(this.main.assets["ship"], pos, "MESH", rotation, false)

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

    changeSceneBackground(scene) {
        // scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);
        scene.clearColor = new BABYLON.Color4(0.7, 0.9, 1, 1);
    }
}