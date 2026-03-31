import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate } from './utils/utils.js';
import { Map } from './Map.js';

export class Map2 extends CreateMap {
    constructor(canvas, engine, havokPlugin, main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 2, 0)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 0
        }

        super(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

        this.createMap()

    }

    createMap() {
        this.createGround(this.scene);
        createMapChangeGate(this.main, Map, new BABYLON.Vector3(0, 0, -1), new BABYLON.Vector3(0, 2, -9), BABYLON.Tools.ToRadians(180), 0)
    }

    mapBeforeRenderUpdate() {

    }

    createGround(scene) {
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 250, height: 250, subdivisions: 2 }, scene);
        ground.material = this.main.materials["ground"];
        addStaticPhysics(ground, "BOX");
    }
}