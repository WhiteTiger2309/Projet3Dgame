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
 * @param main {Main} - The instance of the class Main
 * @param map {Map} - The map to change to
 * @param gatePos {Vector3} - The position of the gate
 * @param playerSpawnPos {Vector3} - The position of the player spawn
 * @param gateRotation {Vector3} - The rotation of the gate
 * @param playerSpawnRotation {Vector3} - The rotation of the player spawn
 */
export function createMapChangeGate(main, map, gatePos, playerSpawnPos, gateRotation = 0, playerSpawnRotation) {
    const instances = main.assets["mapGate"].instantiateModelsToScene((name) => name);
    const gate = instances.rootNodes[0];
    let trigger;
    gate.position = gatePos
    gate.rotationQuaternion = null
    gate.rotation.y = BABYLON.Tools.ToRadians(gateRotation)
    gate.getDescendants().forEach(mesh => {
        mesh.isVisible = false;
        trigger = mesh
        const triggerAggregate = addStaticPhysics(mesh, "BOX");
        triggerAggregate.shape.isTrigger = true;
    });

    trigger.metadata = {
        map: map,
        spawnPos: playerSpawnPos,
        spawnRotation: playerSpawnRotation,
        onTriggerEnter: undefined
    };
    return trigger
}

export function createDiegeticTeleportMarker(scene, position, prefix, accentColor = new BABYLON.Color3(0.22, 0.85, 1.0)) {
    const root = new BABYLON.TransformNode(`${prefix}_teleportMarker_root`, scene);
    root.position = position.clone();

    const baseMat = new BABYLON.StandardMaterial(`${prefix}_teleportMarker_baseMat`, scene);
    baseMat.diffuseColor = new BABYLON.Color3(0.10, 0.12, 0.15);
    baseMat.emissiveColor = accentColor.scale(0.16);
    baseMat.specularColor = BABYLON.Color3.Black();

    const glowMat = new BABYLON.StandardMaterial(`${prefix}_teleportMarker_glowMat`, scene);
    glowMat.diffuseColor = accentColor.scale(0.45);
    glowMat.emissiveColor = accentColor.scale(1.35);
    glowMat.specularColor = BABYLON.Color3.Black();
    glowMat.alpha = 0.92;

    const pad = BABYLON.MeshBuilder.CreateCylinder(`${prefix}_teleportMarker_pad`, {
        diameter: 2.0,
        height: 0.10,
        tessellation: 24,
    }, scene);
    pad.parent = root;
    pad.position.y = 0.05;
    pad.material = baseMat;
    pad.isPickable = false;

    const stem = BABYLON.MeshBuilder.CreateCylinder(`${prefix}_teleportMarker_stem`, {
        diameterTop: 0.16,
        diameterBottom: 0.22,
        height: 0.95,
        tessellation: 16,
    }, scene);
    stem.parent = root;
    stem.position.y = 0.58;
    stem.material = baseMat;
    stem.isPickable = false;

    const ring = BABYLON.MeshBuilder.CreateTorus(`${prefix}_teleportMarker_ring`, {
        diameter: 1.15,
        thickness: 0.08,
        tessellation: 24,
    }, scene);
    ring.parent = root;
    ring.position.y = 1.04;
    ring.material = glowMat;
    ring.isPickable = false;

    const cap = BABYLON.MeshBuilder.CreateSphere(`${prefix}_teleportMarker_cap`, {
        diameter: 0.28,
        segments: 16,
    }, scene);
    cap.parent = root;
    cap.position.y = 1.12;
    cap.material = glowMat;
    cap.isPickable = false;

    return root;
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
    return createGrabbableObject(main, pos, box);
}

export function createGrabbableObject(main, pos, mesh) {
    const defaultPos = pos.clone()
    const meshAggregate = new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.BOX, { mass: 1000, friction: 0.75, restitution: 0 }, main.scene);
    mesh.metadata = {
        meshAggregate: meshAggregate,
        isInteractable: true,
        canBeHeld: true,
        onInteract: () => {
            if (!main.player.heldMesh) {
                main.player.heldMesh = mesh;
                meshAggregate.body.setMassProperties({ mass: 2 })
            }
        },
        respawn: () => {
            meshAggregate.body.disablePreStep = false;
            main.player.dropHeldMesh(meshAggregate)
            meshAggregate.body.setLinearVelocity(0)
            pos.copyFrom(defaultPos)
            setTimeout(() => {
                meshAggregate.body.disablePreStep = true;
            }, 100)
        }
    };
    return mesh
}

export function createTrigger(main, name, pos, width, depth, height, enterFunc, exitFunc) {
    const trigger = BABYLON.MeshBuilder.CreateBox(name, { width: width, depth: depth, height: height }, main.scene);
    trigger.isPickable = false;
    trigger.isVisible = false;
    trigger.position = pos.clone();
    const triggerAggregate = addStaticPhysics(trigger, "BOX");
    triggerAggregate.shape.isTrigger = true;
    main.havokPlugin.onTriggerCollisionObservable.add((ev) => {
        if (ev.collider.transformNode.name === "CCTransformNode" && ev.collidedAgainst.transformNode.name === name) {
            if (ev.type === "TRIGGER_ENTERED") {
                enterFunc()
            }
            else if (ev.type === "TRIGGER_EXITED") {
                exitFunc()
            }
        }
    })
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
            fade(function () {
                if (typeof collidedData?.onTriggerEnter === "function") {
                    collidedData.onTriggerEnter(main, collidedData);
                    return;
                }

                changeMap(collidedData.map, main, collidedData.spawnPos, collidedData.spawnRotation);
            });
        }

        if ((ev.collider.transformNode.name === "CCTransformNode" && ev.collidedAgainst.transformNode.name === "bounceTrigger") && ev.type === "TRIGGER_ENTERED") {
            if (main.player.velocity.y < -3) {
                main.player.velocity.y = main.player.velocity.y * -1.2 - 2.5;
                main.player.isGrounded = false;
                main.player.groundDisableTimer = main.player.GROUND_DISABLE_TIME;
            }
        }

        if (ev.collider.transformNode.name === "pressurePlateTrigger" || ev.collidedAgainst.transformNode.name === "pressurePlateTrigger") {
            if (ev.type === "TRIGGER_ENTERED") {
                collidedData.numberOfTriggered += 1;
                if (collidedData.numberOfTriggered === 1) {
                    collidedData.activatePressurePlate();
                }
            }
            else if (ev.type === "TRIGGER_EXITED") {
                collidedData.numberOfTriggered -= 1;
                if (collidedData.numberOfTriggered === 0) {
                    collidedData.deactivatePressurePlate();
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
    main.player.mapChange()
    main.scene.meshes.filter(mesh => mesh.name !== "preview").forEach(mesh => mesh.dispose());
    main.scene.lights.filter(light => light.name !== "hemi").forEach(light => light.dispose());
    while (main.scene.animationGroups.length) {
        main.scene.animationGroups[0].dispose();
    }
    main.scene.skeletons.forEach(skeleton => skeleton.dispose());

    main.scene.onBeforeRenderObservable.clear()
    const map = new mapToLoad(main, spawnPos, spawnRotation);
    await map.createMap()
    main.map = map
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

export function createAntiBoxGate(main, pos, rotation) {
    const gate = createMeshFromAsset(main.assets["antiBoxGate"], pos, "BOX", BABYLON.Tools.ToRadians(rotation))._children[0]
    gate.metadata.aggregate.shape.isTrigger = true
}

export function createShip(main, pos, rotation) {
    createMeshFromAsset(main.assets["ship2"], pos, "MESH", rotation, false)

    const door = main.scene.getMeshByName("Door");
    door.metadata.defaultPos = door.position.clone();
    door.metadata.isOpen = false;
    door.metadata.aggregate.body.disablePreStep = false;

    const buttonPressedAnimation = main.scene.getAnimationGroupByName("InsideButtonPressed")
    buttonPressedAnimation.stop()

    const insideButton = main.scene.getMeshByName("InsideButton")
    insideButton.metadata = {
        isInteractable: true,
        onInteract: () => {
            if (!buttonPressedAnimation.isPlaying) {
                buttonPressedAnimation.play();
                if (door.metadata.isOpen) {
                    BABYLON.Animation.CreateAndStartAnimation(
                        "shipDoorClose",
                        door,
                        `position.y`,
                        60,
                        60,
                        door.position.y,
                        door.metadata.defaultPos.y,
                        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
                        undefined,
                    );
                } else {
                    BABYLON.Animation.CreateAndStartAnimation(
                        "shipDoorOpen",
                        door,
                        `position.y`,
                        60,
                        60,
                        door.position.y,
                        door.metadata.defaultPos.y + 2.8,
                        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
                        undefined,
                    );
                }
                door.metadata.isOpen = !door.metadata.isOpen;
            }
        }
    }
}