import { Player } from './Player.js';

export class Map {
    scene;
    engine;
    player;
    deltaTime;

    constructor(canvas) {
        this.engine = new BABYLON.Engine(canvas, true);
        this.scene = this.createScene();
        this.createLights(this.scene)
        this.createGround(this.scene);
        this.createSimpleRuins(this.scene);

        this.createPlayer();
        this.modifySettings(this.scene, canvas);

        this.engine.runRenderLoop(() => this.scene.render());
        window.addEventListener("resize", () => this.engine.resize());
    }


    createScene() {
        const scene = new BABYLON.Scene(this.engine);

        // Collisions + gravité (comme tp1_exemple3/4)
        scene.collisionsEnabled = true;
        // scene.gravity = new BABYLON.Vector3(0, -0.1, 0);

        // Un petit boost d'ambiance pour ne pas être trop sombre
        scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);

        // Un peu d'atmosphère, sans aller au-delà du prototype
        scene.clearColor = new BABYLON.Color4(0.02, 0.04, 0.06, 1);

        // this.camera = this.createFpsCamera(scene);

        scene.registerBeforeRender(() => {
            this.beforeRenderUpdate();
        })

        return scene;
    }

    beforeRenderUpdate(){
        this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;
        this.player.beforeRenderUpdate()
    }

    createLights(scene) {
        const hemi = new BABYLON.HemisphericLight(
            "hemi",
            new BABYLON.Vector3(0, 1, 0),
            scene
        );
        hemi.intensity = 0.75;

        const dir = new BABYLON.DirectionalLight(
            "dir0",
            new BABYLON.Vector3(-0.5, -1, 0.2),
            scene
        );
        dir.intensity = 1.25;
        dir.position = new BABYLON.Vector3(50, 80, -30);
    }

    createGround(scene) {
        const ground = BABYLON.MeshBuilder.CreateGround(
            "ground",
            { width: 250, height: 250, subdivisions: 2 },
            scene
        );

        const mat = new BABYLON.StandardMaterial("groundMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
        mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
        ground.material = mat;

        ground.checkCollisions = true;
        return ground;
    }

    createSimpleRuins(scene) {
        // Quelques obstacles simples pour tester collisions + navigation
        const ruinMat = new BABYLON.StandardMaterial("ruinMat", scene);
        ruinMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.22);
        ruinMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.06);

        const makeBlock = (name, size, position) => {
            const mesh = BABYLON.MeshBuilder.CreateBox(name, { size }, scene);
            mesh.position = position.clone();
            mesh.material = ruinMat;
            mesh.checkCollisions = true;
            return mesh;
        };

        // "Vaisseau" très simplifié (repère de spawn)
        const ship = BABYLON.MeshBuilder.CreateBox(
            "ship",
            { width: 6, height: 2, depth: 10 },
            scene
        );
        ship.position = new BABYLON.Vector3(0, 1, -18);
        ship.material = ruinMat;
        ship.checkCollisions = true;

        // Arche / pylônes simplifiés
        makeBlock("pillar1", 3, new BABYLON.Vector3(12, 1.5, 8));
        makeBlock("pillar2", 3, new BABYLON.Vector3(18, 1.5, 8));

        const lintel = BABYLON.MeshBuilder.CreateBox(
            "lintel",
            { width: 10, height: 1.5, depth: 2 },
            scene
        );
        lintel.position = new BABYLON.Vector3(15, 4, 8);
        lintel.material = ruinMat;
        lintel.checkCollisions = true;

        // Quelques rochers
        const rockMat = new BABYLON.StandardMaterial("rockMat", scene);
        rockMat.diffuseColor = new BABYLON.Color3(0.10, 0.10, 0.11);

        const rocks = [
            new BABYLON.Vector3(-8, 1, 6),
            new BABYLON.Vector3(-14, 1, 14),
            new BABYLON.Vector3(6, 1, 18),
        ];

        rocks.forEach((p, i) => {
            const rock = BABYLON.MeshBuilder.CreateSphere(
                `rock_${i}`,
                { diameter: 3 + i * 0.8, segments: 8 },
                scene
            );
            rock.position = p.clone();
            rock.scaling.y = 0.6;
            rock.material = rockMat;
            rock.checkCollisions = true;
        });
    }

    createPlayer() {
        this.player = new Player(this.scene, this.canvas, this)
    }

    modifySettings(scene, canvas) {
        // Pointer lock (comme tp1_exemple4) : click dans le canvas => souris verrouillée
        scene.onPointerDown = () => {
            if (!scene.alreadyLocked) {
                canvas.requestPointerLock();
            }
        };

        document.addEventListener("pointerlockchange", () => {
            const element = document.pointerLockElement || null;
            scene.alreadyLocked = !!element;
        });
    }

}