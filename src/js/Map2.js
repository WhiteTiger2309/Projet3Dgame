import * as BABYLON from '@babylonjs/core'

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics } from './utils/utils.js';

export class Map2 extends CreateMap {
    constructor(canvas, engine, havokPlugin) {
        const PLAYER_SPAWN_POS = new BABYLON.Vector3(0, 3, -10)
        const PLAYER_SPAWN_ROTATION = new BABYLON.Vector3(0, 2, 0)

        super(canvas, engine, havokPlugin, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)

        this.createMap()

        super.startRender()
    }

    createMap() {
        this.createGround(this.scene);
        this.createSimpleRuins(this.scene);
        this.createBox()
        this.createDuck()
    }

    changeSceneBackground(scene) {
        scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);
        scene.clearColor = new BABYLON.Color4(0.02, 0.1, 0.1, 0.5);
        // BABYLON.ImportMeshAsync("lightbluesky.glb").then((result) => {
        //     result.meshes.forEach(mesh => {
        //         mesh.infiniteDistance = true;
        //         mesh.checkCollisions = false;
        //     });
        // });
    }

    mapBeforeRenderUpdate() {
        // this.platformTime += this.deltaTime;

        // const offset = Math.sin(this.platformTime * this.platformSpeed) * this.platformAmplitude;

        // const newPos = new BABYLON.Vector3(
        //     this.platformStartX + offset,
        //     this.ship.position.y,
        //     this.ship.position.z,
        // );

        // this.platformAggregate.body.setTargetTransform(
        //     newPos,
        //     this.ship.rotationQuaternion || BABYLON.Quaternion.Identity()
        // );

        const move = this.speed * this.deltaTime * this.direction;

        this.distance += move;

        if (Math.abs(this.distance) >= this.maxDistance) {
            this.direction *= -1;
        }

        const newPos = this.ship.position.add(new BABYLON.Vector3(move, 0, 0));

        this.platformAggregate.body.setTargetTransform(
            newPos,
            this.ship.rotationQuaternion || BABYLON.Quaternion.Identity()
        );

    }

    createDuck() {
        BABYLON.ImportMeshAsync("duckTest.glb").then((result) => {
            let duck = result.meshes[0]
            duck.position.y = 0.5
            duck.rotationQuaternion = null
            duck.rotation.y = 0.4
            result.meshes.forEach(mesh => {
                if (!(mesh.name == "__root__")) {
                    addStaticPhysics(mesh, "MESH")
                }
            });
        });
    }

    createBox() {
        this.box = BABYLON.MeshBuilder.CreateBox("box", { width: 1, depth: 1, height: 1 }, this.scene);
        this.box.material = new BABYLON.StandardMaterial("boxMat", this.scene);
        this.box.position = new BABYLON.Vector3(3, 30, -10);
        const boxAggregate = new BABYLON.PhysicsAggregate(this.box, BABYLON.PhysicsShapeType.BOX, { mass: 50.25, friction: 0.75, restitution: 0 }, this.scene);
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

        addStaticPhysics(ground, "BOX")

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

            addStaticPhysics(mesh, "BOX")

            return mesh;
        };

        // "Vaisseau" très simplifié (repère de spawn)
        this.ship = BABYLON.MeshBuilder.CreateBox(
            "ship",
            { width: 6, height: 2, depth: 10 },
            scene
        );
        this.ship.position = new BABYLON.Vector3(0, 3.787, -26.41);
        this.ship.material = ruinMat;
        this.platformAggregate = new BABYLON.PhysicsAggregate(this.ship, BABYLON.PhysicsShapeType.BOX, { mass: 0, friction: 0.7, restitution: 0.2 }, this.scene);
        this.platformAggregate.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
        // this.platformTime = 0;
        // this.platformAmplitude = 5;   // distance max
        // this.platformSpeed = 1;       // vitesse
        // this.platformStartX = this.ship.position.x;

        this.direction = 1;
        this.distance = 0;
        this.maxDistance = 5;
        this.speed = 2

        const ship2 = BABYLON.MeshBuilder.CreateBox(
            "ship2",
            { width: 6, height: 2, depth: 10 },
            scene
        );
        ship2.position = new BABYLON.Vector3(0, 1, -18);
        ship2.material = ruinMat;
        ship2.rotate(BABYLON.Vector3.Left(), 2.5)
        addStaticPhysics(ship2, "BOX")

        const ship3 = BABYLON.MeshBuilder.CreateBox(
            "ship3",
            { width: 6, height: 2, depth: 10 },
            scene
        );
        ship3.position = new BABYLON.Vector3(5, 1, -18);
        ship3.material = ruinMat;
        ship3.rotate(BABYLON.Vector3.Left(), 2)
        addStaticPhysics(ship3, "BOX")

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
        addStaticPhysics(lintel, "BOX")


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

            addStaticPhysics(rock, "CONVEX_HULL")

        });
    }
}