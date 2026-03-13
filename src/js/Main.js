import * as BABYLON from '@babylonjs/core'
import HavokPhysics from "@babylonjs/havok";
import '@babylonjs/loaders'
import { Map } from './Map.js';
import { Map2 } from './Map2.js';
import { Map3 } from './Map3.js';

export class Main {

    constructor() {
        this.canvas = document.querySelector("canvas");
        this.engine = new BABYLON.Engine(this.canvas, true);

        window.addEventListener("resize", () => this.engine.resize())

        this.start()
    }

    async start() {
        await this.initGame()
    }

    async initGame() {
        const havokInstance = await HavokPhysics();
        this.havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);

        this.startGame(this.canvas, this.engine, this.havokPlugin)
    }

    startGame(canvas, engine, havokPlugin) {
        new Map(canvas, engine, havokPlugin)
        // new Map2(canvas, engine, havokPlugin)
        // new Map3(canvas, engine, havokPlugin)
    }

}