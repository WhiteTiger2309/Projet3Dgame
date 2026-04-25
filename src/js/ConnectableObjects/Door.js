import * as BABYLON from '@babylonjs/core'
import { createMeshFromAsset } from '../utils/utils'
import { Destination } from './Destination'

export class Door extends Destination{

    constructor(main, position, rotation, canBeRewired, direction, distance) {
        super(main, position, rotation, canBeRewired)
        this.direction = direction
        this.distance = distance
        this.defaultPos = position.clone()
        this.mesh = this.createMesh(position, rotation)
    }

    createMesh(pos, rotation) {
        const door = createMeshFromAsset(this.main.assets["door"], pos, "BOX", BABYLON.Tools.ToRadians(rotation))._children[0]
        door.metadata.connectable = this;
        return door
    }

    activate() {
        this.mesh.metadata.aggregate.body.disablePreStep = false;
        BABYLON.Animation.CreateAndStartAnimation(
            "doorOpen",
            this.mesh,
            `position.${this.direction}`,
            60,
            60,
            this.mesh.position[this.direction],
            this.defaultPos[this.direction] + this.distance,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            undefined,
            () => {
                this.mesh.metadata.aggregate.body.disablePreStep = true;
            }
        );
    }

    deactivate() {
        this.mesh.metadata.aggregate.body.disablePreStep = false;
        BABYLON.Animation.CreateAndStartAnimation(
            "doorClose",
            this.mesh,
            `position.${this.direction}`,
            60,
            60,
            this.mesh.position[this.direction],
            this.defaultPos[this.direction],
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            undefined,
            () => {
                this.mesh.metadata.aggregate.body.disablePreStep = true;
            }
        );
    }

}