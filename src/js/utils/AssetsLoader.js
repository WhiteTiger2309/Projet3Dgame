import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'

export class AssetsLoader {

    constructor(main) {
        this.scene = main.scene;
        this.main = main;
        this.assetsManager = new BABYLON.AssetsManager(this.scene);
        this.assetsManager.useDefaultLoadingScreen = false;
    }

    async loadModel(name, file) {
        const meshTask = this.assetsManager.addContainerTask(name, name, "models/", file);
        meshTask.onSuccess = (task) => {
            this.main.assets[name] = task.loadedContainer;
        };
    }

    async loadTexture(name, url, onReady) {
        const textureTask = this.assetsManager.addTextureTask(name, url);

        textureTask.onSuccess = (task) => {
            this.main.textures[name] = task.texture;
            if (onReady) onReady(task.texture);
        };
    }

    async loadSound(name, url) {
        const soundTask = this.assetsManager.addBinaryFileTask(name, url);

        soundTask.onSuccess = (task) => {
            const sound = new BABYLON.Sound(name, task.data, this.scene);
            this.main.sounds[name] = sound;
        };
    }

    async preloadAllAssets() {
        this.loadModel("testMap", "testMap.glb")
        this.loadModel("robot", "robot.glb")
        this.loadModel("ship", "shipTest.glb")
        this.loadModel("mapGate", "testLevelChange.glb")

        this.loadTexture("asphalt", "/assets/terrain/asphalt_01.jpg", (texture) => {
            const mat = new BABYLON.StandardMaterial("groundMat", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 28;
            mat.diffuseTexture.vScale = 28;
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
            mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
            this.main.materials["ground"] = mat;

        })
        this.loadTexture("space", "/assets/space/space1.png", (texture) => {
            const mat = new BABYLON.StandardMaterial("spaceSkyAboveMat", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 1;
            mat.diffuseTexture.vScale = 1;
            mat.emissiveTexture = mat.diffuseTexture;
            mat.disableLighting = true;
            mat.backFaceCulling = false;
            this.main.materials["spaceSkyAbove"] = mat;
        })

        this.assetsManager.onProgress = (remaining, total) => {
            console.log(`Loading: ${total - remaining}/${total}`);
        };

        await new Promise(resolve => {
            this.assetsManager.onFinish = () => {
                console.log("All assets loaded");
                resolve();
            };
            this.assetsManager.load();
        });
    }
}