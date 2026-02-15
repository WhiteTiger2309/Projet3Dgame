import { Map } from './Map.js';

export class Main {
    scene;
    canvas;
    
    constructor(){
        this.canvas = document.querySelector("#myCanvas");
        this.scene = this.startGame(this.canvas)
    }


    startGame() {
        new Map(this.canvas)
    }

}