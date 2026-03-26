import * as BABYLON from '@babylonjs/core'
import HavokPhysics from "@babylonjs/havok";
import '@babylonjs/loaders'

import { changeMap } from './utils/utils.js';
import { Map } from './Map.js';
import { Map2 } from './Map2.js';
import { Map3 } from './Map3.js';
import { MapTest } from './Map_test.js';

export class Main {

    constructor() {
        this.canvas = document.querySelector("canvas");
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.currentScene = null;
        this.playerData = {
            canHoldMeshes: true,
            canJump: true,
            hasGrapplingHook: true
        }

        window.addEventListener("resize", () => this.engine.resize())

        this.start()
    }

    async start() {
        await this.initGame()
    }

    async initGame() {
        this.havokInstance = await HavokPhysics();
        this.havokPlugin = new BABYLON.HavokPlugin(true, this.havokInstance);

        this.startGame(this.canvas, this.engine, this.havokPlugin)
    }

    async loadScene(createSceneFn) {
        if (this.currentScene) {
            this.engine.stopRenderLoop();
            await this.currentScene.whenReadyAsync();
            this.currentScene.dispose();
            this.havokPlugin = new BABYLON.HavokPlugin(true, this.havokInstance);
        }

        this.currentScene = createSceneFn(this.canvas, this.engine, this.havokPlugin, this);
        this.startRender()
    }

    startRender() {
        this.engine.runRenderLoop(() => {
            if (window.document.hasFocus()) {
                this.currentScene.render();
            }
        })
    }

    startGame(canvas, engine, havokPlugin) {
        changeMap(Map, this);
    }

}