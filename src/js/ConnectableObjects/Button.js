import * as BABYLON from '@babylonjs/core'
import { createMeshFromAsset, addStaticPhysics, placeOnMesh } from '../utils/utils'
import { Door } from './Door.js';
import { Source } from './Source.js';

export class Button extends Source{

    constructor(main, position, rotation, canBeRewired, connectedTo = null) {
        super(main, position, rotation, canBeRewired, connectedTo)
        this.defaultPos = position.clone()
        this.mesh = this.createMesh(position, rotation)
    }

    createMesh(pos, rotation) {
        const button = createMeshFromAsset(this.main.assets["button"], pos, "BOX", BABYLON.Tools.ToRadians(rotation), false)._children[0]
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