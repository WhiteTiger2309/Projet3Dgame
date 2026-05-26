import * as BABYLON from '@babylonjs/core'
import { createMeshFromAsset, addStaticPhysics, placeOnMesh } from '../utils/utils'
import { Door } from './Door.js';
import { Source } from './Source.js';

export class Button extends Source {

    constructor(main, position, rotation, canBeRewired, connectedTo = null, rotationX = null) {
        super(main, position, rotation, canBeRewired, connectedTo)
        this.defaultPos = position.clone()
        this.mesh = this.createMesh(position, rotation, rotationX)
    }

    createMesh(pos, rotation, rotationX) {
        const root = createMeshFromAsset(this.main.assets["button"], pos, "BOX", BABYLON.Tools.ToRadians(rotation), false)
        if (rotationX != null) {
            root.rotation.z = BABYLON.Tools.ToRadians(rotationX)
        }
        const button = root._children[0]

        button.metadata = {
            isInteractable: true,
            connectable: this,
            onInteract: () => {
                this.activate();
            }
        }
        return button
    }
}