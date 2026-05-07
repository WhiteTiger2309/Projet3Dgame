import * as BABYLON from '@babylonjs/core'

import { DefautlMapPuzzle } from './DefautlMapPuzzle.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox } from './utils/utils.js';
import { Map } from './Map.js';
import { PressurePlate } from './ConnectableObjects/PressurePlate.js';
import { Door } from './ConnectableObjects/Door.js';
import { Button } from './ConnectableObjects/Button.js';
import { MapPuzzle2 } from './MapPuzzle2.js';

export class MapPuzzle1 extends DefautlMapPuzzle {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)
    }

    // TODO changer le puzzle
    createPuzzle() {
        new PressurePlate(this.main, new BABYLON.Vector3(2.3, 1.1, -0.8), 0, false, this.exitDoor)
        createBox(this.main, new BABYLON.Vector3(-3.9, 1.2, -1.2), 1)
        this.gate.metadata.map = MapPuzzle2;
    }

}