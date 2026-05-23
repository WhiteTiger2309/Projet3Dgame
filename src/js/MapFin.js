import * as BABYLON from '@babylonjs/core'

import { DefautlMapPuzzle } from './DefautlMapPuzzle.js';
import { createDiegeticTeleportMarker, createMapChangeGate } from './utils/utils.js';
import { Robot } from './Robot.js';

export class MapFin extends DefautlMapPuzzle {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)
        this.player.stateMachine.states.dialog.dialogManager.changeDialog("DialogFin")
    }

    createPuzzle() {
        this.robot = new Robot(this.main, new BABYLON.Vector3(4.9, 1.2, 3.0), 90, "DialogFin");

        const returnGatePos = new BABYLON.Vector3(0, 0, 1.5);
        const returnGate = createMapChangeGate(this.main, undefined, returnGatePos, undefined, 0);
        returnGate.metadata.onTriggerEnter = () => this.main.returnToEndMenu();

        createDiegeticTeleportMarker(this.scene, returnGatePos, 'fin');
    }

}