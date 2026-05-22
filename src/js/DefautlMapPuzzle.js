import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox } from './utils/utils.js';
import { PressurePlate } from './ConnectableObjects/PressurePlate.js';
import { Door } from './ConnectableObjects/Door.js';
import { Button } from './ConnectableObjects/Button.js';
import { MapPuzzle1 } from './MapPuzzle1.js';

export class DefautlMapPuzzle extends CreateMap {
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

        this.gate = createMapChangeGate(this.main, MapPuzzle1, new BABYLON.Vector3(-0.1, 0, -13.5), undefined, 180);
        this.createPuzzle();
    }

    createPuzzle() {

    }

    createLab(pos) {
        // TODO changer textures du modèle 3D de la map
        createMeshFromAsset(this.main.assets["defaultMap"], pos, "MESH")
    }

    // TODO changer lumières
    createLights(scene) {
        this.light = new BABYLON.PointLight("labLight1", new BABYLON.Vector3(0, 4, 0), scene);
        this.light.intensity = 75;
        this.main.mainLight.intensity = 0.2;
        this.main.mainLight.direction.y = 0;
    }

}