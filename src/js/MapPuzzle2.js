import * as BABYLON from '@babylonjs/core'

import { DefautlMapPuzzle } from './DefautlMapPuzzle.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBox, createShape } from './utils/utils.js';
import { PressurePlate } from './ConnectableObjects/PressurePlate.js';
import { Door } from './ConnectableObjects/Door.js';
import { Button } from './ConnectableObjects/Button.js';
import { MapLazer1 } from './Map_lazer1.js';

export class MapPuzzle2 extends DefautlMapPuzzle {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)
        this.player.playerData.hasLinkPower = true
    }

    // TODO changer le puzzle
    createPuzzle() {
        this.exitDoor = new Door(this.main, new BABYLON.Vector3(-0.1, 0, -12.8), 0, false, "y", 3)
        new Door(this.main, new BABYLON.Vector3(-7.5, 0, -1.8), 90, true, "y", 3)
        createShape(this.main, new BABYLON.Vector3(-2.3, 0.5, -3), 0.5, 0.5, 1.5)
        createShape(this.main, new BABYLON.Vector3(-9.7, 1.5, -4), 5, 0.5, 5)
        createShape(this.main, new BABYLON.Vector3(-9.7, 1.5, 0.5), 5, 0.5, 5)
        createShape(this.main, new BABYLON.Vector3(-9.7, 3.8, -1.75), 5, 5, 0.5)
        new Button(this.main, new BABYLON.Vector3(-2.2, 1.3, -3), 0, true, null, 90)
        new PressurePlate(this.main, new BABYLON.Vector3(2.3, 1.1, -0.8), 0, false, this.exitDoor)
        createBox(this.main, new BABYLON.Vector3(-9.3, 1.2, -1.8), 1)


        this.gate.metadata.map = MapLazer1;
    }

    createLights(scene) {
        this.light = new BABYLON.PointLight("labLight1", new BABYLON.Vector3(0, 4, 0), scene);
        this.light.intensity = 75;
        this.main.mainLight.intensity = 0.2;
        this.main.mainLight.direction.y = 0;
    }


}