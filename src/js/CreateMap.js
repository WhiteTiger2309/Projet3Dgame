import * as BABYLON from '@babylonjs/core'

export class CreateMap {
    constructor(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main) {
        this.main = main
        this.player = main.player
        this.player.respawnPos = PLAYER_SPAWN_POS
        this.player.respawnRotation = PLAYER_SPAWN_ROTATION
        this.deltaTime = main.deltaTime

        this.scene = main.scene;

        this.createLights(this.scene)
        this.changeSceneBackground(this.scene)
        this.player.resetPos()
    }

    createLights(scene) {
        this.light = new BABYLON.DirectionalLight("dir0", new BABYLON.Vector3(-0.5, -1, 0.2), scene);
        this.light.intensity = 1.25;
        this.light.position = new BABYLON.Vector3(550, 280, -300);

        this.scene.clearColor = new BABYLON.Color3(0, 0, 0);
    }

    beforeRenderUpdate() {
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;
        this.player.beforeRenderUpdate(this.deltaTime)
        this.mapBeforeRenderUpdate()
    }

    changeSceneBackground(scene) { }
    mapBeforeRenderUpdate() { }

}