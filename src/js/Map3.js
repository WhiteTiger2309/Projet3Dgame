import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics } from './utils/utils.js';

export class Map3 extends CreateMap{
    constructor(canvas, engine, havokPlugin, main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 3, 0)
        PLAYER_SPAWN_ROTATION = 2

        super(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

        this.createImportedMap()
    }

    // à rajouter si besoin de faire des updates chaque frame, comme des plateformes qui bougent
    // mapBeforeRenderUpdate(){
    // }

    createImportedMap() {
        // from the game carrotales to test import
        BABYLON.ImportMeshAsync("niveau1.glb").then((result) => {
            result.meshes.forEach(mesh => {
                if (!(mesh.name == "__root__")) {
                    addStaticPhysics(mesh, "MESH")
                }
            });
        });
    }

}