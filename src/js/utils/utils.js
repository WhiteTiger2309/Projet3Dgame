import * as BABYLON from '@babylonjs/core'

/**
 * Create and add PhysicsAggregate with static motion type to the TransformNode.
 * @param mesh {TransformNode} - The physics-enabled object used as the physics aggregate
 * @param shapeName {String} - The string name of the shape of the physics aggregate. Can be SPHERE, CAPSULE, CYLINDER, BOX, CONVEX_HULL, CONTAINER, MESH or HEIGHTFIELD.
 */
export function addStaticPhysics(mesh, shapeName) {
    const shapeType = BABYLON.PhysicsShapeType[shapeName];
    const meshAggregate = new BABYLON.PhysicsAggregate(mesh, shapeType, { mass: 0, friction: 0.7, restitution: 0.2 });
    meshAggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
    return meshAggregate;
}

export function createButton(defaultPos, activateFunc, deactivateFunc, scene) {
    const button = BABYLON.MeshBuilder.CreateBox("button", { width: 1, depth: 1, height: 0.2 }, scene);
    button.material = new BABYLON.StandardMaterial("buttonMat", scene);
    button.position = defaultPos;
    const meshAggregate = addStaticPhysics(button, "BOX")
    meshAggregate.body.disablePreStep = false;

    const triggerPos = defaultPos.clone().addInPlace(new BABYLON.Vector3(0, +0.25, 0));
    const buttonTrigger = BABYLON.MeshBuilder.CreateBox("buttonTrigger", { width: 0.98, depth: 0.98, height: 0.05 }, scene);
    buttonTrigger.position = triggerPos;
    buttonTrigger.isVisible = false;
    buttonTrigger.metadata = {
        numberOfTriggered: 0,
        activateButton: () => {
            button.position = defaultPos.clone().addInPlace(new BABYLON.Vector3(0, -0.1, 0));
            activateFunc();
        },
        deactivateButton: () => {
            button.position = defaultPos.clone()
            deactivateFunc();
        }
    };
    const triggerAggregate = addStaticPhysics(buttonTrigger, "BOX");
    triggerAggregate.shape.isTrigger = true;
}

export function addTriggerObservable(havokPlugin) {
    havokPlugin.onTriggerCollisionObservable.add((ev) => {
        // console.log(ev.type, ':', ev.collider.transformNode.name, '-', ev.collidedAgainst.transformNode.name);
        if (ev.collidedAgainst.transformNode.name === "buttonTrigger" || ev.collider.transformNode.name === "buttonTrigger") {
            if (ev.type === "TRIGGER_ENTERED") {
                ev.collidedAgainst.transformNode.metadata.numberOfTriggered += 1;
                if (ev.collidedAgainst.transformNode.metadata.numberOfTriggered === 1) {
                    ev.collidedAgainst.transformNode.metadata.activateButton();
                }
            }
            else if (ev.type === "TRIGGER_EXITED") {
                ev.collidedAgainst.transformNode.metadata.numberOfTriggered -= 1;
                if (ev.collidedAgainst.transformNode.metadata.numberOfTriggered === 0) {
                    ev.collidedAgainst.transformNode.metadata.deactivateButton();
                }
            }
        }
    });
}