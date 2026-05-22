import * as BABYLON from '@babylonjs/core'

import { DefautlMapPuzzle } from './DefautlMapPuzzle.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox } from './utils/utils.js';
import { Robot } from './Robot.js';
import { PressurePlate } from './ConnectableObjects/PressurePlate.js';
import { Door } from './ConnectableObjects/Door.js';
import { Button } from './ConnectableObjects/Button.js';
import { MapPuzzle2 } from './MapPuzzle2.js';

export class MapPuzzle1 extends DefautlMapPuzzle {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)
        this.player.playerData.hasLinkPower = true
        this.player.stateMachine.states.dialog.dialogManager.changeDialog("DialogTuto")
    }

    createPuzzle() {
        this.robot = new Robot(this.main, new BABYLON.Vector3(4.9, 1.2, 3.0), 90)
        this.exitDoor = new Door(this.main, new BABYLON.Vector3(-0.1, 0, -12.8), 0, true, "y", 3)
        new PressurePlate(this.main, new BABYLON.Vector3(2.3, 1.1, -0.8), 0, true)
        createBox(this.main, new BABYLON.Vector3(-3.9, 1.2, -1.2), 1)
        this.gate.metadata.map = MapPuzzle2;
    }

}