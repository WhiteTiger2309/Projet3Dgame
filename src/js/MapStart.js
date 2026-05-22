import * as BABYLON from '@babylonjs/core'
const BASE = import.meta.env.BASE_URL || '/';

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBox, createAntiBoxGate, placeOnMesh, createGrabbableObject, createShip, createTrigger } from './utils/utils.js';
import { MapLab } from './MapLab.js';

export class MapStart extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            // PLAYER_SPAWN_POS = new BABYLON.Vector3(24.7, 7.6, 33.4)
            PLAYER_SPAWN_POS = new BABYLON.Vector3(26.3, 8.2, 41.8)
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

        createShip(this.main, placeOnMesh(this.main, new BABYLON.Vector3(26.3, 8, 40)), BABYLON.Tools.ToRadians(90))
        createMapChangeGate(this.main, MapLab, new BABYLON.Vector3(29, 0, -20.8), undefined, BABYLON.Tools.ToRadians(180))
        createTrigger(this.main, "jumpTuto", new BABYLON.Vector3(28.2, 1.9, 1.7), 10, 5, 3,
            () => {
                tipsOverlay.style.display = "block"
                tipsOverlay.innerText = "Space to jump"
            },
            () => {
                tipsOverlay.style.display = "none"
            })
    }

    mapBeforeRenderUpdate() {

    }

    createTerrain(pos) {
        const ground = createMeshFromAsset(this.main.assets["terrain"], pos, "MESH", undefined, false)
        ground.getDescendants().forEach(mesh => {
            if (mesh.name == "invisibleWalls") {
                mesh.isVisible = false;
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
        doorsOpen.play();
    }

    createLandscapeGround(scene) {
        return new Promise((resolve) => {
            this.ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("ground", BASE + 'images/hmap2.jpg', {
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

    changeSceneBackground(scene) {
        // scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);
        scene.clearColor = new BABYLON.Color4(0.7, 0.9, 1, 1);
    }
}