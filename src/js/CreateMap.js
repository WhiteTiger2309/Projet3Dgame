import * as BABYLON from '@babylonjs/core'

export class CreateMap {
    constructor(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main) {
        this.engine = engine;
        this.canvas = canvas;
        this.havokPlugin = havokPlugin;
        this.main = main
        this.player = main.player
        this.player.respawnPos = PLAYER_SPAWN_POS
        this.player.respawnRotation = PLAYER_SPAWN_ROTATION

        this.scene = main.scene;

        this.createLights(this.scene)
        this.changeSceneBackground(this.scene)
        this.player.resetPos()
    }

    createLights(scene) {
        const dir = new BABYLON.DirectionalLight("dir0", new BABYLON.Vector3(-0.5, -1, 0.2), scene);
        dir.intensity = 1.25;
        dir.position = new BABYLON.Vector3(50, 80, -30);

        this.scene.clearColor = new BABYLON.Color3(0.8, 0.9, 1.0);
    }

    beforeRenderUpdate() {
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;
        this.player.beforeRenderUpdate(this.deltaTime)
        this.isPlayerOob()
        this.mapBeforeRenderUpdate()
    }

    isPlayerOob() {
        if (this.player.player.position.y < -20) {
            this.player.respawn()
        }
    }

    changeSceneBackground(scene) { }
    mapBeforeRenderUpdate() { }

}