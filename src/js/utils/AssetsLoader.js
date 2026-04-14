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

    async loadImage(name, url) {
        const imageTask = this.assetsManager.addImageTask(name, url);
        imageTask.onSuccess = (task) => {
            this.main.images[name] = task.image;
        };
    }

    async loadSound(name, url) {
        const soundTask = this.assetsManager.addBinaryFileTask(name, url);
        soundTask.onSuccess = (task) => {
            if (!this.main.soundBuffers) {
                this.main.soundBuffers = {};
            }

            let audioData = task.data;
            try {
                audioData = this.normalizeBinaryAudioData(task.data);
            } catch {
                // Keep original data if normalization fails.
            }

            this.main.soundBuffers[name] = audioData;
        };
    }

    normalizeBinaryAudioData(data) {
        if (!data) return data;
        if (data instanceof ArrayBuffer) return data;
        if (ArrayBuffer.isView(data)) {
            const view = data;
            return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
        }
        return data;
    }

    async preloadAllAssets() {
        this.loadImage("ground", "images/hmap.jpeg")

        this.loadModel("puzzleMap1", "puzzleMap1.glb")
        this.loadModel("cave", "cave.glb")
        this.loadModel("robot", "robot.glb")
        this.loadModel("ship", "shipTest.glb")
        this.loadModel("mapGate", "testLevelChange.glb")
        this.loadModel("structure", "structure.glb")
        for (let i = 1; i <= 5; i++) {
            this.loadModel("ruins" + i, "ruins" + i + ".glb")
        }
        this.loadModel("ruinsPuzzleMap", "ruinsPuzzleMap.glb")
        this.loadModel("slime", "slime.glb")


        this.loadTexture("asphalt", "/assets/terrain/asphalt_01.jpg", (texture) => {
            const mat = new BABYLON.StandardMaterial("groundMat", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 50;
            mat.diffuseTexture.vScale = 50;
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
            mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
            this.main.materials["ground"] = mat;
        })
        
        const mat = new BABYLON.StandardMaterial("nonElectric", this.scene);
        this.main.materials["nonElectric"] = mat;
        const mat2 = new BABYLON.StandardMaterial("electric", this.scene);
        mat2.emissiveColor = new BABYLON.Color3(1, 1, 0);
        this.main.materials["electric"] = mat2;

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

        // Audio buffers preloaded for SoundManager (music + footsteps).
        this.loadSound("ambientMusic", "/sounds/main_theme.mp3");
        this.loadSound("footstep_0", "/sounds/51124243-footstep-372877.mp3");
        this.loadSound("footstep_1", "/sounds/footstep-safe.wav");

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