import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox, createButton, openDoor, closeDoor, createDoor } from './utils/utils.js';
import { Map } from './Map.js';

export class MapLab extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 1, 9)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 180
        }
        PLAYER_SPAWN_ROTATION = BABYLON.Tools.ToRadians(PLAYER_SPAWN_ROTATION)

        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

    }

    async createMap() {
        this.createLab(new BABYLON.Vector3(0, 0, 0));
        const door1 = createDoor(this.main, new BABYLON.Vector3(9.3, 0, -4.9), 0)
        createButton(this.main, new BABYLON.Vector3(2.3, 1.1, -0.8), () => openDoor(door1, "y", 3), () => closeDoor(door1, "y"))
    }

    mapBeforeRenderUpdate() {

    }

    createLab(pos) {
        createMeshFromAsset(this.main.assets["lab"], pos, "MESH")
    }

    createLights(scene) {
        this.light = new BABYLON.PointLight("labLight1", new BABYLON.Vector3(-4.8, 1.9, -1.7), scene);
        this.light.intensity = 100.25;
        this.main.mainLight.intensity = 0.2;
        this.main.mainLight.direction.y = 0;
    }

}