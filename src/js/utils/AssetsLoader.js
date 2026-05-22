import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'
const BASE = import.meta.env.BASE_URL || '/';

export class AssetsLoader {

    constructor(main) {
        this.scene = main.scene;
        this.main = main;
        this.assetsManager = new BABYLON.AssetsManager(this.scene);
        this.assetsManager.useDefaultLoadingScreen = false;
        this.soundPromises = [];
    }

    async loadModel(name, file) {
        const meshTask = this.assetsManager.addContainerTask(name, name, BASE + "models/", file);
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

    async loadImage(name, url) {
        const imageTask = this.assetsManager.addImageTask(name, url);
        imageTask.onSuccess = (task) => {
            this.main.images[name] = task.image;
        };
    }

    async loadSound(name, url, loop = false, volume = 1) {
        const promise = BABYLON.CreateSoundAsync(name, url).then(sound => {
            sound.loop = loop;
            sound.volume = volume;

            this.main.sounds[name] = sound;
        });

        this.soundPromises.push(promise);
    }

    async preloadAllAssets() {
        //////////////////// 3D models ////////////////////
        this.loadModel("robot", "robot.glb")
        this.loadModel("ship", "shipTest.glb")
        this.loadModel("mapGate", "mapChangeGate.glb")
        this.loadModel("slime", "slime.glb")
        this.loadModel("door", "door.glb")
        this.loadModel("antiBoxGate", "antiBoxGate.glb")
        this.loadModel("terrain", "terrain.glb")
        this.loadModel("doors", "doors.glb")
        this.loadModel("lab", "lab.glb")
        this.loadModel("button", "button.glb")
        this.loadModel("defaultMap", "defaultMap.glb")

        //////////////////// images ////////////////////
        this.loadImage("ground", BASE + "images/hmap2.jpg")

        //////////////////// materials ////////////////////
        this.loadTexture("asphalt", BASE + "assets/terrain/asphalt_01.jpg", (texture) => {
            const mat = new BABYLON.StandardMaterial("groundMat", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 50;
            mat.diffuseTexture.vScale = 50;
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
            mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
            mat.diffuseTexture.updateSamplingMode(4)
            this.main.materials["ground"] = mat;
        })

        this.loadTexture("snow", BASE + "images/snow_ground_128.jpg", (texture) => {
            const mat = new BABYLON.StandardMaterial("snow", this.scene);
            mat.emissiveTexture = texture
            mat.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.03);
            mat.emissiveTexture.uScale = 200;
            mat.emissiveTexture.vScale = 200;
            mat.disableLighting = true
            mat.emissiveTexture.updateSamplingMode(4)

            this.main.materials["snow"] = mat;
        })

        const mat = new BABYLON.StandardMaterial("nonElectric", this.scene);
        this.main.materials["nonElectric"] = mat;
        const mat2 = new BABYLON.StandardMaterial("electric", this.scene);
        mat2.emissiveColor = new BABYLON.Color3(1, 1, 0);
        this.main.materials["electric"] = mat2;

        this.loadTexture("space", BASE + "assets/space/space1.png", (texture) => {
            const mat = new BABYLON.StandardMaterial("spaceSkyAboveMat", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 1;
            mat.diffuseTexture.vScale = 1;
            mat.emissiveTexture = mat.diffuseTexture;
            mat.disableLighting = true;
            mat.backFaceCulling = false;
            this.main.materials["spaceSkyAbove"] = mat;
        })

        //////////////////// sounds ////////////////////
        this.loadSound("ambientMusic", BASE + "sounds/main_theme.mp3", true, 0.01);
        this.loadSound("menuMusic", BASE + "sounds/menu_theme.mp3", true, 0.05);
        this.loadSound("footstep1", BASE + "sounds/footstep1.wav", false, 0.15);
        this.loadSound("footstep2", BASE + "sounds/footstep2.wav", false, 0.15);
        this.loadSound("footstep3", BASE + "sounds/footstep3.wav", false, 0.15);
        this.loadSound("footstep4", BASE + "sounds/footstep4.wav", false, 0.15);

        ////////////////////////////////////////
        this.assetsManager.onProgress = (remaining, total) => {
            console.log(`Loading: ${total - remaining}/${total}`);
        };

        await Promise.all([
            await new Promise(resolve => {
                this.assetsManager.onFinish = () => {
                    console.log("All assets loaded");
                    resolve();
                };
                this.assetsManager.load();
            }),
            Promise.all(this.soundPromises)
        ]);
    }
}