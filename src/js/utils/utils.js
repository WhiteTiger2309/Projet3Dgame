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
export function createMapChangeGate(main, map, gatePos, playerSpawnPos, gateRotation, playerSpawnRotation) {
    const instances = main.assets["mapGate"].instantiateModelsToScene((name) => name);
    // Some GLBs instantiate multiple root nodes. If we move only the first one,
    // parts of the gate (visuals/trigger) may stay elsewhere.
    const gate = new BABYLON.TransformNode("mapGateRoot", main.scene);
    instances.rootNodes.forEach((node) => {
        // Parent every root node under a single node so the whole gate moves together.
        node.parent = gate;
    });
    gate.position = gatePos;
    gate.rotationQuaternion = null;
    gate.rotation.y = gateRotation ?? 0;

    // Keep the gate visible: only the trigger mesh should be invisible.
    const childMeshes = gate.getChildMeshes
        ? gate.getChildMeshes()
        : gate.getDescendants().filter(d => d instanceof BABYLON.AbstractMesh);

    // Try to find a dedicated trigger mesh in the GLB.
    let triggerMesh =
        childMeshes.find(m => m.name === "mapChangeTrigger") ||
        childMeshes.find(m => /mapChangeTrigger/i.test(m.name)) ||
        null;

    // If the GLB has no trigger mesh, create one (invisible) as a child of the gate.
    if (!triggerMesh) {
        triggerMesh = BABYLON.MeshBuilder.CreateBox(
            "mapChangeTrigger",
            { width: 2.2, height: 2.8, depth: 2.2 },
            main.scene
        );
        triggerMesh.parent = gate;
        triggerMesh.position = new BABYLON.Vector3(0, 1.4, 0);
    }

    // Ensure the visible parts are actually visible/enabled.
    childMeshes.forEach(m => {
        if (m === triggerMesh) return;
        m.setEnabled(true);
        m.isVisible = true;
    });

    // If the GLB provides no visible geometry (only a trigger), create a simple marker.
    const hasVisualMesh = childMeshes.some(m => m !== triggerMesh);
    if (!hasVisualMesh) {
        const marker = BABYLON.MeshBuilder.CreateCylinder(
            "mapGateMarker",
            { diameter: 1.6, height: 2.6, tessellation: 24 },
            main.scene
        );
        marker.parent = gate;
        marker.position = new BABYLON.Vector3(0, 1.3, 0);

        const mat = new BABYLON.StandardMaterial("mapGateMarkerMat", main.scene);
        mat.emissiveColor = new BABYLON.Color3(0.3, 0.8, 1.0);
        mat.disableLighting = false;
        marker.material = mat;
    }

    triggerMesh.setEnabled(true);
    triggerMesh.isVisible = false;
    triggerMesh.isPickable = false;
    const triggerAggregate = addStaticPhysics(triggerMesh, "BOX");
    triggerAggregate.shape.isTrigger = true;

    triggerMesh.metadata = {
        ...(triggerMesh.metadata || {}),
        map: map,
        spawnPos: playerSpawnPos,
        spawnRotation: playerSpawnRotation,
    };

    return { gate, trigger: triggerMesh };
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

export function addTriggerObservable(havokPlugin, main) {
    havokPlugin.onTriggerCollisionObservable.add((ev) => {
        // console.log(ev.type, ':', ev.collider.transformNode.name, '-', ev.collidedAgainst.transformNode.name);

        const colliderData = ev.collider.transformNode.metadata
        const collidedData = ev.collidedAgainst.transformNode.metadata

        // if ((ev.collider.transformNode.name === "accesCard" && ev.collidedAgainst.transformNode.name === "cardReaderTrigger") && ev.type === "TRIGGER_ENTERED") {
        //     const doorsOpen = main.scene.getAnimationGroupByName("DoorOpening")
        //     doorsOpen.play()
        //     ev.collidedAgainst.dispose();
        // }

        if ((ev.collider.transformNode.name === "box" && ev.collidedAgainst.transformNode.name === "AntiBoxGate") && ev.type === "TRIGGER_ENTERED") {
            colliderData.respawn()
        }

        if (ev.type === "TRIGGER_ENTERED") {
            const isPlayer = (node) => node?.name === "CCTransformNode";
            const getGateData = (node) => node?.metadata?.map ? node.metadata : null;

            if (isPlayer(ev.collider.transformNode)) {
                const gateData = getGateData(ev.collidedAgainst.transformNode);
                if (gateData) {
                    fade(function () { changeMap(gateData.map, main, gateData.spawnPos, gateData.spawnRotation) });
                }
            } else if (isPlayer(ev.collidedAgainst.transformNode)) {
                const gateData = getGateData(ev.collider.transformNode);
                if (gateData) {
                    fade(function () { changeMap(gateData.map, main, gateData.spawnPos, gateData.spawnRotation) });
                }
            }
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
    main.player.dropHeldMesh();
    main.scene.meshes.filter(mesh => mesh.name !== "preview").forEach(mesh => mesh.dispose());
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

export function createAntiBoxGate(main, pos, rotation) {
    const gate = createMeshFromAsset(main.assets["antiBoxGate"], pos, "BOX", BABYLON.Tools.ToRadians(rotation))._children[0]
    gate.metadata.aggregate.shape.isTrigger = true
}

/**
 * Create a ship at a teleporter gate with interactive door.
 * @param main {Main} - The instance of the class Main
 * @param pos {Vector3} - The position of the ship
 * @param rotation {Number} - The rotation in radians (default 90 degrees)
 */
export function createShipAtGate(main, pos, rotation = BABYLON.Tools.ToRadians(90)) {
    // Instantiate ship from asset
    const ship = createMeshFromAsset(main.assets["ship"], pos, "MESH", rotation, false);

    // Find and configure the door
    const door = main.scene.getMeshByName("Door");
    if (door) {
        door.metadata.defaultPos = door.position.clone();
        door.metadata.isOpen = true;
        door.metadata.aggregate.body.disablePreStep = false;
        door.position = door.metadata.defaultPos.clone().addInPlace(new BABYLON.Vector3(0, 2, 0));
    }

    // Find and configure the button animation
    const buttonPressedAnimation = main.scene.getAnimationGroupByName("InsideButtonPressed");
    if (buttonPressedAnimation) {
        buttonPressedAnimation.stop();
    }

    // Find and configure the button interaction
    const insideButton = main.scene.getMeshByName("InsideButton");
    if (insideButton) {
        insideButton.metadata = {
            isInteractable: true,
            onInteract: () => {
                if (buttonPressedAnimation && !buttonPressedAnimation.isPlaying) {
                    buttonPressedAnimation.play();
                    // Toggle door state
                    if (door) {
                        if (door.metadata.isOpen) {
                            door.position = door.metadata.defaultPos.clone();
                        } else {
                            door.position = door.metadata.defaultPos.clone().addInPlace(new BABYLON.Vector3(0, 2, 0));
                        }
                        door.metadata.isOpen = !door.metadata.isOpen;
                    }
                }
            }
        };
    }

    return ship;
}
