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

/**
 * Create a gate to change map.
 * @param map {Map} - The map to change to
 * @param gatePos {Vector3} - The position of the gate
 * @param playerSpawnPos {Vector3} - The position of the player spawn
 * @param gateRotation {Vector3} - The rotation of the gate
 * @param playerSpawnRotation {Vector3} - The rotation of the player spawn
 */
export function createMapChangeGate(main, map, gatePos, playerSpawnPos, gateRotation, playerSpawnRotation) {
    const instances = main.assets["mapGate"].instantiateModelsToScene((name) => name);
    const gate = instances.rootNodes[0];
    let trigger;
    gate.position = gatePos
    gate.rotationQuaternion = null
    gate.rotation.y = gateRotation
    gate.getDescendants().forEach(mesh => {
        if (mesh.metadata?.gltf?.extras.collisions) {
            mesh.metadata.aggregate = addStaticPhysics(mesh, "MESH")
        }
        if (mesh.name == "mapChangeTrigger") {
            mesh.isVisible = false;
            trigger = mesh
            const triggerAggregate = addStaticPhysics(mesh, "BOX");
            triggerAggregate.shape.isTrigger = true;
        }
    });

    trigger.metadata = {
        map: map,
        spawnPos: playerSpawnPos,
        spawnRotation: playerSpawnRotation
    };
}

export function createBounceSlime(main, pos) {
    const instances = main.assets["slime"].instantiateModelsToScene((name) => name);
    const slime = instances.rootNodes[0];
    slime.position = placeOnMesh(main, pos)
    slime.getDescendants().forEach(mesh => {
        if (mesh.metadata?.gltf?.extras.collisions) {
            mesh.metadata.aggregate = addStaticPhysics(mesh, "CONVEX_HULL")
        }
        if (mesh.name == "bounceTrigger") {
            mesh.isVisible = false;
            const triggerAggregate = addStaticPhysics(mesh, "BOX");
            triggerAggregate.shape.isTrigger = true;
        }
    });
}

export function createBox(main, pos, size) {
    const box = BABYLON.MeshBuilder.CreateBox("box", { width: size, depth: size, height: size }, main.scene);
    box.position = pos;
    const defaultPos = pos.clone()
    const boxAggregate = new BABYLON.PhysicsAggregate(box, BABYLON.PhysicsShapeType.BOX, { mass: 1000, friction: 0.75, restitution: 0 }, main.scene);
    box.metadata = {
        boxAggregate: boxAggregate,
        isInteractable: true,
        canBeHeld: true,
        onInteract: () => {
            if (!main.player.heldMesh) {
                main.player.heldMesh = box;
                boxAggregate.body.setMassProperties({ mass: 2 })
            }
        },
        respawn: () => {
            boxAggregate.body.disablePreStep = false;
            main.player.dropHeldMesh(boxAggregate)
            boxAggregate.body.setLinearVelocity(0)
            pos.copyFrom(defaultPos)
            setTimeout(() => {
                boxAggregate.body.disablePreStep = true;
            }, 100)
        }
    };
    return box
}



export function createButton(main, pos, activateFunc, deactivateFunc) {
    const button = BABYLON.MeshBuilder.CreateBox("button", { width: 1.5, depth: 1.5, height: 0.2 }, main.scene);
    const defaultPos = placeOnMesh(main, pos)
    button.position = defaultPos;
    const meshAggregate = addStaticPhysics(button, "BOX")
    meshAggregate.body.disablePreStep = false;

    const triggerPos = defaultPos.clone().addInPlace(new BABYLON.Vector3(0, +0.25, 0));
    const buttonTrigger = BABYLON.MeshBuilder.CreateBox("buttonTrigger", { width: 1.48, depth: 1.48, height: 0.05 }, main.scene);
    buttonTrigger.position = triggerPos;
    buttonTrigger.isVisible = false;
    buttonTrigger.metadata = {
        numberOfTriggered: 0,
        activateButton: () => {
            button.position = defaultPos.clone().addInPlace(new BABYLON.Vector3(0, -0.08, 0));
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

export function openDoor(door, dir) {
    door.metadata.aggregate.body.disablePreStep = false;
    BABYLON.Animation.CreateAndStartAnimation(
        "doorOpen",
        door,
        `position.${dir}`,
        60,
        10,
        door.position[dir],
        door.metadata.defaultPos[dir] + 5,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
        undefined,
        () => {
            door.metadata.aggregate.body.disablePreStep = true;
        }
    );
}

export function closeDoor(door, dir) {
    door.metadata.aggregate.body.disablePreStep = false;
    BABYLON.Animation.CreateAndStartAnimation(
        "doorClose",
        door,
        `position.${dir}`,
        60,
        10,
        door.position[dir],
        door.metadata.defaultPos[dir],
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
        undefined,
        () => {
            door.metadata.aggregate.body.disablePreStep = true;
        }
    );
}

export function addTriggerObservable(havokPlugin, main) {
    havokPlugin.onTriggerCollisionObservable.add((ev) => {
        // console.log(ev.type, ':', ev.collider.transformNode.name, '-', ev.collidedAgainst.transformNode.name);

        const colliderData = ev.collider.transformNode.metadata
        const collidedData = ev.collidedAgainst.transformNode.metadata
        if ((ev.collider.transformNode.name === "box" && ev.collidedAgainst.transformNode.name === "AntiBoxGate") && ev.type === "TRIGGER_ENTERED") {
            colliderData.respawn()
        }

        if ((ev.collider.transformNode.name === "CCTransformNode" && ev.collidedAgainst.transformNode.name === "mapChangeTrigger") && ev.type === "TRIGGER_ENTERED") {
            fade(function () { changeMap(collidedData.map, main, collidedData.spawnPos, collidedData.spawnRotation) });
        }

        if ((ev.collider.transformNode.name === "CCTransformNode" && ev.collidedAgainst.transformNode.name === "bounceTrigger") && ev.type === "TRIGGER_ENTERED") {
            console.log(main.player.velocity.y)
            if (main.player.velocity.y < -3) {
                main.player.velocity.y = main.player.velocity.y * -1.2 - 2.5;
                main.player.isGrounded = false;
                main.player.groundDisableTimer = main.player.GROUND_DISABLE_TIME;
            }
        }

        if (ev.collider.transformNode.name === "buttonTrigger" || ev.collidedAgainst.transformNode.name === "buttonTrigger") {
            if (ev.type === "TRIGGER_ENTERED") {
                collidedData.numberOfTriggered += 1;
                if (collidedData.numberOfTriggered === 1) {
                    collidedData.activateButton();
                }
            }
            else if (ev.type === "TRIGGER_EXITED") {
                collidedData.numberOfTriggered -= 1;
                if (collidedData.numberOfTriggered === 0) {
                    collidedData.deactivateButton();
                }
            }
        }
    });
}

/**
 * Run a function during a fade to black screen.
 * @param func {Function} - The function to run
 */
export function fade(func) {
    if (respawnOverlay.getAnimations().length > 0) {
        return
    }
    respawnOverlay.classList.add("fade-in");
    const fadeInHandler = () => {
        respawnOverlay.removeEventListener("animationend", fadeInHandler);
        func();
        respawnOverlay.classList.remove("fade-in");
        respawnOverlay.classList.add("fade-out");

        const fadeOutHandler = () => {
            respawnOverlay.removeEventListener("animationend", fadeOutHandler);
            respawnOverlay.classList.remove("fade-out");
        };
        respawnOverlay.addEventListener("animationend", fadeOutHandler);
    };
    respawnOverlay.addEventListener("animationend", fadeInHandler);
}

/**
 * Change the scene to the new map.
 * @param mapToLoad {Map} - The map to change to
 * @param main {Main} - The instance of the class Main
 * @param spawnPos {Vector3} - The position of the player spawn
 * @param spawnRotation {Vector3} - The rotation of the player spawn
 */
export async function changeMap(mapToLoad, main, spawnPos, spawnRotation) {
    main.scene.meshes.filter(mesh => mesh.name !== "grapplingHook").forEach(mesh => mesh.dispose());
    main.scene.lights.filter(light => light.name !== "hemi").forEach(light => light.dispose());
    while (main.scene.animationGroups.length) {
        main.scene.animationGroups[0].dispose();
    }
    main.scene.skeletons.forEach(skeleton => skeleton.dispose());

    main.scene.onBeforeRenderObservable.clear()
    const map = new mapToLoad(main, spawnPos, spawnRotation);
    await map.createMap()
    main.scene.registerBeforeRender(() => {
        map.beforeRenderUpdate();
    })
    return map;
}

export function placeOnGround(ground, x, z) {
    const pos = new BABYLON.Vector3(x, 0, z)
    const y = ground.getHeightAtCoordinates(x, z);
    pos.y = y
    return pos
}

export function placeOnMesh(main, pos) {
    main.ray.origin.copyFrom(pos);
    const pickInfo = main.scene.pickWithRay(main.ray, (mesh) => {
        return (mesh.physicsBody && !(mesh.physicsBody?.shape.isTrigger));
    });
    if (pickInfo.hit) {
        pos.y = pickInfo.pickedPoint.y
    }
    return pos
}

export function createMeshFromAsset(asset, pos, collisionsShape, rotation, allCollisions = true) {
    const instances = asset.instantiateModelsToScene((name) => name);
    const root = instances.rootNodes[0];
    root.position = pos
    if (!(rotation == undefined)) {
        root.rotationQuaternion = null
        root.rotation.y = rotation
    }

    root.metadata = root.metadata ? structuredClone(root.metadata) : {};
    root.getDescendants().forEach(mesh => {
        mesh.metadata = mesh.metadata ? structuredClone(mesh.metadata) : {}
        if (allCollisions) {
            mesh.metadata.aggregate = addStaticPhysics(mesh, collisionsShape)
        }
        else {
            if (mesh.metadata?.gltf?.extras.collisions) {
                mesh.metadata.aggregate = addStaticPhysics(mesh, collisionsShape)
            }
        }
    })
    return root
}

export function createDoor(main, pos, rotation) {
    const door = createMeshFromAsset(main.assets["door"], pos, "BOX", BABYLON.Tools.ToRadians(rotation))._children[0]
    door.metadata.defaultPos = door.position.clone()
    return door
}

export function createAntiBoxGate(main, pos, rotation) {
    const gate = createMeshFromAsset(main.assets["antiBoxGate"], pos, "BOX", BABYLON.Tools.ToRadians(rotation))._children[0]
    gate.metadata.aggregate.shape.isTrigger = true
}
