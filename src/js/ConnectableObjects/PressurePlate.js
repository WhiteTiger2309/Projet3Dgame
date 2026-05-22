import * as BABYLON from '@babylonjs/core'
import { addStaticPhysics, placeOnMesh } from '../utils/utils'
import { Door } from './Door.js';
import { Source } from './Source.js';

export class PressurePlate extends Source {

    constructor(main, position, rotation, canBeRewired, connectedTo = null) {
        super(main, position, rotation, canBeRewired, connectedTo)
        this.defaultPos = placeOnMesh(main, position)
        this.mesh = this.createMesh(position, rotation)
        this.isActivated = false
    }

    onConnect(target) {
        this.connectedTo = target;
        if (this.isActivated) {
            this.activate();
        }
    }

    createMesh(pos) {
        const pressurePlate = BABYLON.MeshBuilder.CreateBox("pressurePlate", { width: 1.5, depth: 1.5, height: 0.2 }, this.main.scene);
        pressurePlate.position = this.defaultPos;
        const meshAggregate = addStaticPhysics(pressurePlate, "BOX")
        meshAggregate.body.disablePreStep = false;
        pressurePlate.metadata = {
            connectable: this
        }

        const triggerPos = this.defaultPos.clone().addInPlace(new BABYLON.Vector3(0, +0.25, 0));
        const pressurePlateTrigger = BABYLON.MeshBuilder.CreateBox("pressurePlateTrigger", { width: 1.48, depth: 1.48, height: 0.05 }, this.main.scene);
        pressurePlateTrigger.isPickable = false;
        pressurePlateTrigger.position = triggerPos;
        pressurePlateTrigger.isVisible = false;
        pressurePlateTrigger.metadata = {
            numberOfTriggered: 0,
            activatePressurePlate: () => {
                pressurePlate.position = this.defaultPos.clone().addInPlace(new BABYLON.Vector3(0, -0.08, 0));
                this.isActivated = true
                this.activate();
            },
            deactivatePressurePlate: () => {
                pressurePlate.position = this.defaultPos.clone()
                this.isActivated = false
                this.deactivate();
            }
        };
        const triggerAggregate = addStaticPhysics(pressurePlateTrigger, "BOX");
        triggerAggregate.shape.isTrigger = true;
        return pressurePlate
    }
}