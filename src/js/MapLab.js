import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox } from './utils/utils.js';
import { Robot } from './Robot.js';
import { MapPuzzle1 } from './MapPuzzle1.js';

import { PressurePlate } from './ConnectableObjects/PressurePlate.js';
import { Door } from './ConnectableObjects/Door.js';
import { Button } from './ConnectableObjects/Button.js';

export class MapLab extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 1, 9)
            // PLAYER_SPAWN_POS = new BABYLON.Vector3(1.1, 1.1, -10.4)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 180
        }
        PLAYER_SPAWN_ROTATION = BABYLON.Tools.ToRadians(PLAYER_SPAWN_ROTATION)

        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

    }

    async createMap() {
        this.createLab(new BABYLON.Vector3(0, 0, 0));
        this.robot = new Robot(this.main, new BABYLON.Vector3(-0.4, 1.1, -12.9), 180)
        const door1 = new Door(this.main, new BABYLON.Vector3(9.3, 0, -4.9), 0, false, "y", 3)
        this.exitDoor = new Door(this.main, new BABYLON.Vector3(13, 0, 4.9), 90, true, "y", 3)
        createBox(this.main, new BABYLON.Vector3(-3.2, 1.2, -1.5), 1)
        new PressurePlate(this.main, new BABYLON.Vector3(2.3, 1.1, -0.8), 0, false, door1)
        this.exitButton = new Button(this.main, new BABYLON.Vector3(12.1, 1.1, 2), 0, true)

        createMapChangeGate(this.main, MapPuzzle1, new BABYLON.Vector3(14, 0, 5), undefined, 90);
    }

    mapBeforeRenderUpdate() {

    }

    createLab(pos) {
        createMeshFromAsset(this.main.assets["lab"], pos, "MESH")
    }

    createLights(scene) {
        
        this.light = new BABYLON.PointLight("labLight1", new BABYLON.Vector3(-3, 4, -1.5), scene);
        this.light.intensity = 50;
        this.light2 = new BABYLON.PointLight("labLight2", new BABYLON.Vector3(-0.4, 4, -12.1), scene);
        this.light2.intensity = 50;
        
        this.main.mainLight.intensity = 0.2;
        this.main.mainLight.direction.y = 0;
    }

}