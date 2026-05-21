import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'

export class AssetsLoader {

    constructor(main) {
        this.scene = main.scene;
        this.main = main;
        this.assetsManager = new BABYLON.AssetsManager(this.scene);
        this.assetsManager.useDefaultLoadingScreen = false;
        this.soundPromises = [];
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
        this.loadModel("puzzleMap1", "puzzleMap1.glb")
        this.loadModel("cave", "cave.glb")
        this.loadModel("robot", "robot.glb")
        this.loadModel("ship", "shipTest.glb")
        this.loadModel("mapGate", "mapChangeGate.glb")
        this.loadModel("structure", "structure.glb")
        for (let i = 1; i <= 5; i++) {
            this.loadModel("ruins" + i, "ruins" + i + ".glb")
        }
        this.loadModel("ruinsPuzzleMap", "ruinsPuzzleMap.glb")
        this.loadModel("slime", "slime.glb")
        this.loadModel("wall", "wall.glb")
        this.loadModel("wallPillar", "wallPillar.glb")
        this.loadModel("door", "door.glb")
        this.loadModel("antiBoxGate", "antiBoxGate.glb")
        this.loadModel("terrain", "terrain.glb")
        this.loadModel("doors", "doors.glb")
        this.loadModel("lab", "lab.glb")
        this.loadModel("accesCard", "accesCard.glb")
        this.loadModel("button", "button.glb")
        this.loadModel("defaultMap", "defaultMap.glb")

        //////////////////// images ////////////////////
        this.loadImage("ground", "images/hmap.jpeg")
        this.loadImage("ground2", "images/hmap2.jpg")

        //////////////////// materials ////////////////////
        this.loadTexture("asphalt", "/assets/terrain/asphalt_01.jpg", (texture) => {
            const mat = new BABYLON.StandardMaterial("groundMat", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 50;
            mat.diffuseTexture.vScale = 50;
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
            mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
            mat.diffuseTexture.updateSamplingMode(4)
            this.main.materials["ground"] = mat;
        })

        this.loadTexture("ground", "/images/ground_diffuse.jpg", (texture) => {
            const mat = new BABYLON.StandardMaterial("groundMat2", this.scene);
            mat.diffuseTexture = texture
            mat.diffuseTexture.uScale = 10;
            mat.diffuseTexture.vScale = 10;
            mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
            mat.diffuseTexture.updateSamplingMode(4)
            mat.bumpTexture = new BABYLON.Texture("images/ground_normal.jpg", this.scene);
            mat.bumpTexture.level = 1.0;
            mat.bumpTexture.uScale = 20;
            mat.bumpTexture.vScale = 20;
            mat.invertNormalMapX = true;
            this.main.materials["ground2"] = mat;
        })

        this.loadTexture("snow", "/images/snow_ground_128.jpg", (texture) => {
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

        //////////////////// sounds ////////////////////
        this.loadSound("ambientMusic", "/sounds/main_theme.mp3", true, 0.01);
        this.loadSound("menuMusic", "/sounds/menu_theme.mp3", true, 0.05);
        this.loadSound("footstep1", "/sounds/footstep1.wav", false, 0.15);
        this.loadSound("footstep2", "/sounds/footstep2.wav", false, 0.15);
        this.loadSound("footstep3", "/sounds/footstep3.wav", false, 0.15);
        this.loadSound("footstep4", "/sounds/footstep4.wav", false, 0.15);

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