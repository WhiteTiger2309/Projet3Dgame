import * as BABYLON from '@babylonjs/core'
const BASE = import.meta.env.BASE_URL || '/';

import { CreateMap } from './CreateMap.js';
import { addStaticPhysics, createMapChangeGate, placeOnGround, createMeshFromAsset, createBounceSlime, createBox, createAntiBoxGate, placeOnMesh, createGrabbableObject, createShip } from './utils/utils.js';
import { Map } from './Map.js';
import { MapLab } from './MapLab.js';

export class MapStart extends CreateMap {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        if (PLAYER_SPAWN_POS == undefined) {
            // PLAYER_SPAWN_POS = new BABYLON.Vector3(28.0, 1.9, -6.6)
            PLAYER_SPAWN_POS = new BABYLON.Vector3(34.7, 8.0, 41.9)
        }
        if (PLAYER_SPAWN_ROTATION == undefined) {
            PLAYER_SPAWN_ROTATION = 177
        }
        PLAYER_SPAWN_ROTATION = BABYLON.Tools.ToRadians(PLAYER_SPAWN_ROTATION)

        super(PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION, main)

    }

    async createMap() {
        await this.createLandscapeGround(this.scene);
        this.createTerrain(new BABYLON.Vector3(30, 1, 20));
        this.createDoors(new BABYLON.Vector3(30, 1, 20));
        // this.createCard(new BABYLON.Vector3(37.8, 3, -17.2))

        createShip(this.main, placeOnMesh(this.main, new BABYLON.Vector3(35.4, 7.7, 40.3)), BABYLON.Tools.ToRadians(90))
        this.createTurretTest(this.getTurretTestPosition());
        createMapChangeGate(this.main, MapLab, new BABYLON.Vector3(29, 0, -20.8), undefined, BABYLON.Tools.ToRadians(180))
    }

    mapBeforeRenderUpdate() {

    }

    createTerrain(pos) {
        const ground = createMeshFromAsset(this.main.assets["terrain"], pos, "MESH")
        ground.getDescendants().forEach(mesh => {
            if (mesh.name == "cardReaderTrigger") {
                mesh.isVisible = false;
                mesh.metadata.aggregate.shape.isTrigger = true;
            }
        })
    }

    createDoors(pos) {
        const doors = createMeshFromAsset(this.main.assets["doors"], pos, "MESH")
        doors.getDescendants().forEach(door => {
            door.metadata.aggregate.body.disablePreStep = false;
        })
        const doorsOpen = this.scene.getAnimationGroupByName("DoorOpening")
        doorsOpen.stop();
        doorsOpen.play();
    }

    createTurretTest(pos) {
        if (!this.main.assets["turret"]) {
            console.warn('[MapStart] turret asset not available for test placement');
            return null;
        }

        const turret = createMeshFromAsset(this.main.assets["turret"], pos, "MESH", BABYLON.Tools.ToRadians(90), false);
        turret.scaling = new BABYLON.Vector3(0.9, 0.9, 0.9);

        const descendants = turret.getDescendants().filter(mesh => mesh.getBoundingInfo);
        let minY = Number.POSITIVE_INFINITY;
        for (const mesh of descendants) {
            const bb = mesh.getBoundingInfo();
            if (bb && bb.boundingBox) {
                const worldMin = bb.boundingBox.minimumWorld.y;
                if (isFinite(worldMin) && worldMin < minY) {
                    minY = worldMin;
                }
            }
        }

        if (isFinite(minY)) {
            const delta = pos.y - minY;
            turret.position.y += delta;
            console.log(`[MapStart] turret test placed with dy=${delta.toFixed(3)}`);
        }

        return turret;
    }

    getTurretTestPosition() {
        const spawnPos = this.player.respawnPos.clone();
        const forward = new BABYLON.Vector3(
            Math.sin(this.player.respawnRotation),
            0,
            Math.cos(this.player.respawnRotation)
        );
        const testPos = spawnPos.add(forward.scale(5));
        return placeOnGround(this.ground, testPos.x, testPos.z);
    }

    // createCard(pos) {
    //     const card = createMeshFromAsset(this.main.assets["accesCard"], pos, "BOX", undefined, false).getDescendants()[0]
    //     createGrabbableObject(this.main, pos, card)
    // }


    createLandscapeGround(scene) {
        return new Promise((resolve) => {
            this.ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap("ground", BASE + 'images/hmap2.jpg', {
                width: 2000,
                height: 2000,
                subdivisions: 50,
                minHeight: -42,
                maxHeight: 20,
                onReady: (ground) => {
                    // ground.material = this.main.materials["ground2_2"];
                    ground.material = this.main.materials["snow"];
                    // addStaticPhysics(ground, "MESH");
                    // ground.updateCoordinateHeights()

                    resolve(ground);
                }
            }, scene);
        })
    }

    changeSceneBackground(scene) {
        // scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);
        scene.clearColor = new BABYLON.Color4(0.7, 0.9, 1, 1);
    }
}