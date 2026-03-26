import * as BABYLON from '@babylonjs/core'

import { PlayerInput } from "./PlayerInput.js";
import { StateMachine } from "./playerStates/StateMachine.js";
import { fade } from './utils/utils.js';

export class Player {

    constructor(scene, canvas, respawnPos, respawnRotation, main) {
        this.isGrounded = false;
        this.isSprinting = false;
        this.lowFriction = false;
        this.groundDisableTimer = 0;
        this.jumpBufferTimer = 0;
        this.velocity = BABYLON.Vector3.Zero();
        this.inheritedVelocity = BABYLON.Vector3.Zero();
        this.heldMesh = null;
        this.isHoldingMesh = false;
        this.lastY = 0
        this.lastYCounter = 0
        this.line = BABYLON.MeshBuilder.CreateLines("grapplingHook", { points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()], updatable: true });
        this.line.color = new BABYLON.Color3(0, 0, 0);
        this.grapplingHookTimer = 0;

        this.scene = scene;
        this.canvas = canvas;
        this.playerData = main.playerData

        this.stateMachine = new StateMachine(this)

        this.GRAVITY = this.scene._physicsEngine.gravity;

        this.WALK_SPEED = 4.5;
        this.SPRINT_SPEED = 5.7;
        this.JUMP_FORCE = 4.7;
        this.SENSITIVITY = 0.0008;
        this.MAX_SLOPE_ANGLE = 60;
        this.BASE_FOV = 1.1
        this.SPRINT_FOV = 1.3

        this.GROUND_DISABLE_TIME = 0.1;
        this.JUMP_BUFFER_TIME = 0.15;
        this.GRAPPLING_HOOK_COOLDOWN = 0.3;

        this.speed = this.WALK_SPEED;
        this.fov = this.BASE_FOV

        this.highlight = new BABYLON.HighlightLayer("highlight", scene);
        this.highlight.innerGlow = false
        this.highlight.blurHorizontalSize = 0.8
        this.highlight.blurVerticalSize = 0.8

        this.createPlayer(respawnPos, respawnRotation)
        this.cameraRotation()

        // BUG ICI
        // this.outliner = new BABYLON.SelectionOutlineLayer("outliner", scene)
        // this.outliner.outlineColor = BABYLON.Color3.White()
        // this.outliner.outlineThickness = 3.0;

        this.input = new PlayerInput(scene);
    }


    createPlayer(respawnPos, respawnRotation) {
        let playerHeight = 1.8;
        let playerWidth = 0.7;
        if (respawnPos == undefined) {
            respawnPos = new BABYLON.Vector3(0, 3, 0)
        }
        this.respawnPos = respawnPos;

        this.player = new BABYLON.TransformNode("player", this.scene);
        this.player.isVisible = false;
        // this.player = BABYLON.MeshBuilder.CreateCapsule("player", { height: playerHeight, radius: playerWidth / 2 }, this.scene);
        // this.player.isVisible = true;

        this.player.position.copyFrom(respawnPos);

        this.character = new BABYLON.PhysicsCharacterController(respawnPos, { capsuleHeight: (playerHeight - 0.3), capsuleRadius: (playerWidth / 2) }, this.scene);

        this.head = new BABYLON.TransformNode("head", this.scene);
        this.head.position.y = 0.8;
        if (respawnRotation == undefined) {
            respawnRotation = BABYLON.Vector3.Zero();
        }
        this.respawnRotation = respawnRotation;
        this.head.rotation.y = respawnRotation;
        this.head.parent = this.player;

        this.camera = new BABYLON.FreeCamera("camera", BABYLON.Vector3.Zero(), this.scene);
        this.camera.minZ = 0.1;
        this.camera.fov = this.fov

        this.pickRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero(), 4);
        this.grapplingHookRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero(), 20);

        this.camera.parent = this.head;


        // // // // temp camera pour debug commenter la ligne au dessus aussi
        // this.camera.attachControl(this.canvas);
        // this.camera.position = new BABYLON.Vector3(-6, 6, -13.8)
        // this.camera.setTarget(this.player.position)
        // this.camera.speed = 0.6;
        // this.camera.angularSensibility = 3000;
        // this.camera.inertia = 0.7;
        // var rayHelper = new BABYLON.RayHelper(this.grapplingHookRay);
        // rayHelper.show(this.scene);
        // // // //


        this.hand = new BABYLON.TransformNode("hand", this.scene);
        this.hand.parent = this.camera;
        this.hand.position = new BABYLON.Vector3(0, 0, 3);
    }

    cameraRotation() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && this.scene.alreadyLocked && this.stateMachine.checkIfCanMove()) {
                const event = pointerInfo.event;

                this.head.rotation.y += event.movementX * this.SENSITIVITY;
                this.camera.rotation.x += event.movementY * this.SENSITIVITY;

                this.camera.rotation.x = BABYLON.Scalar.Clamp(this.camera.rotation.x, -Math.PI / 2, Math.PI / 2);
            }
        });
    }

    // fonction appelé à chaque frame
    beforeRenderUpdate(deltaTime) {
        this.deltaTime = deltaTime;
        if (this.stateMachine.checkIfCanMove()) {
            this.updateGrounded();
            this.applyGravity();
            this.grapplingHook();
            this.updateFromControls();
            this.updateRayPos(this.pickRay);
            this.checkPickRayHit();
            this.updateHandPos();
            this.updateHeldMeshPos();
        }
        this.stateMachine.update();

        // debug
        if (this.input.justPressed["debug"]) {
            // console.log(this.character._position)
            // console.log(this.camera.rotation.x)
            // this.stateMachine.currentState.nextState = this.stateMachine.states.other
            // console.log(this.character._position.y)
            // console.log(this.input.inputMap)
            this.respawn()
            // console.log(this.map.box.position);
            // console.log(this.velocity.y);
        }
        if (this.input.justPressed["KeyO"]) {
            this.playerData.canJump = !this.playerData.canJump
        }
    }


    updateFromControls() {
        // movement
        let inputX = this.input.horizontal || 0;
        let inputZ = this.input.vertical || 0;

        let forward = this.camera.getDirection(BABYLON.Axis.Z);
        let right = this.camera.getDirection(BABYLON.Axis.X);

        forward.y = 0;
        right.y = 0;

        forward.normalize();
        right.normalize();

        let move = BABYLON.Vector3.Zero();
        move.addInPlace(forward.scale(inputZ));
        move.addInPlace(right.scale(inputX));

        if (move.length() > 0) {
            move.normalize();
        }

        move = this.applyRampModification(move)
        this.applyCeilingHitModification();

        // apply movement
        const velocityXZ = Math.abs(this.velocity.x) + Math.abs(this.velocity.z)
        if (this.isGrounded) {
            if (move.length() > 0) {
                const velocityXZMove = Math.abs(this.velocity.x * move.x) + Math.abs(this.velocity.z * move.z)
                if (this.lowFriction) {
                    this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 3);
                    this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 3);
                    if (velocityXZMove <= this.speed) {
                        this.lowFriction = false
                    }
                }
                else {
                    this.velocity.x = move.x * this.speed;
                    this.velocity.z = move.z * this.speed;
                }
            }
            else {
                if (this.lowFriction) {
                    this.velocity.x = BABYLON.Lerp(this.velocity.x, 0, this.deltaTime * 3);
                    this.velocity.z = BABYLON.Lerp(this.velocity.z, 0, this.deltaTime * 3);
                    if (velocityXZ <= 2) {
                        this.lowFriction = false
                    }
                }
                else {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                    this.isSprinting = false;
                }
            }
            this.lerpCameraTo(this.fov)
            this.velocity.addInPlace(this.supportInfo.averageSurfaceVelocity);
        }
        else if (this.isSprinting) {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 2);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 2);
        }
        else if (move.length() > 0) {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 3);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 3);
        }
        else {
            if (this.lowFriction) {
                this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 2);
                this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 2);
            }
            else {
                this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.speed, this.deltaTime * 10)
                this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.speed, this.deltaTime * 10)
            }
        }

        this.character.moveWithCollisions(this.velocity.scale(this.deltaTime));
        this.player.position.copyFrom(this.character.getPosition());
    }

    applyRampModification(move) {
        if (this.isGrounded && this.groundNormal.y != 1) {
            move = this.projectOnPlane(move, this.groundNormal).normalize();

            const angle = Math.acos(BABYLON.Vector3.Dot(this.groundNormal, BABYLON.Vector3.Up()));
            const angleDeg = BABYLON.Tools.ToDegrees(angle);

            if (this.isGrounded && angleDeg < this.MAX_SLOPE_ANGLE) {
                if (move.y < 0) {
                    this.velocity.y += move.y * this.speed;
                }
                else {
                    const xzLength = Math.sqrt(move.x * move.x + move.z * move.z);
                    if (xzLength > 0) {
                        move.x /= xzLength;
                        move.z /= xzLength;
                        const lateralFactor = Math.cos(angle);
                        let right = this.camera.getDirection(BABYLON.Axis.X);
                        right.y = 0;
                        right.normalize();
                        const lateralDot = move.x * right.x + move.z * right.z;
                        move.x -= right.x * lateralDot * (1 - lateralFactor);
                        move.z -= right.z * lateralDot * (1 - lateralFactor);
                    }
                }
            }
            else {
                this.isGrounded = false;
            }
        }
        return move
    }

    projectOnPlane(vector, normal) {
        const dot = BABYLON.Vector3.Dot(vector, normal);
        return vector.subtract(normal.scale(dot));
    }

    applyGravity() {
        if (!this.isGrounded || this.velocity.y > 0) {
            this.velocity.y += this.GRAVITY.y * this.deltaTime;
        }
        else {
            this.velocity.y = 0;
        }
    }

    updateGrounded() {
        if (this.groundDisableTimer > 0) {
            this.groundDisableTimer -= this.deltaTime;
            this.isGrounded = false;
            return;
        }
        this.supportInfo = this.character.checkSupport(this.deltaTime, this.GRAVITY.normalizeToNew());
        if (this.supportInfo.supportedState === BABYLON.CharacterSupportedState.SUPPORTED) {
            this.isGrounded = true;
            this.groundNormal = this.supportInfo.averageSurfaceNormal;
        }
        else {
            this.isGrounded = false;
            this.groundNormal = null;
        }
    }

    updateRayPos(ray) {
        this.camera.getForwardRayToRef(ray, ray.length);
        ray.origin.copyFrom(this.head.getAbsolutePosition());
    }

    checkPickRayHit() {
        const pickInfo = this.scene.pickWithRay(this.pickRay);

        if (pickInfo.hit) {
            if (pickInfo.pickedMesh.metadata?.canBeHeld && !this.playerData.canHoldMeshes) {
                return;
            }
            if (pickInfo.pickedMesh.metadata?.isInteractable) {
                this.highlight.addMesh(pickInfo.pickedMesh, BABYLON.Color3.White());
                // this.outliner.addSelection(pickInfo.pickedMesh);

                if (pickInfo.pickedMesh.metadata?.onInteract && this.input.justPressed["interact"]) {
                    pickInfo.pickedMesh.metadata.onInteract();
                }
            }
        } else {
            this.highlight.removeAllMeshes()
            // this.outliner.clearSelection();

        }
    }

    // à faire empecher le joueur de sauter sur l'objet tenu
    updateHandPos() {
        if (!this.playerData.canHoldMeshes) {
            return;
        }
        if (this.heldMesh) {
            const pickInfo = this.scene.pickWithRay(this.pickRay, (mesh) => {
                return !(mesh === this.heldMesh); // ou si physics
            });
            if (pickInfo.hit) {
                this.hand.position.z = Math.max(pickInfo.distance - 0.5, 1)
            }
            else {
                this.hand.position.z = 3
            }
        }
    }

    updateHeldMeshPos() {
        if (!this.playerData.canHoldMeshes) {
            return;
        }
        if (this.heldMesh) {
            this.highlight.removeAllMeshes()
            // this.outliner.clearSelection();

            const aggregate = this.heldMesh.metadata.boxAggregate;
            aggregate.body.setAngularVelocity(BABYLON.Vector3.Zero());
            aggregate.body.setLinearVelocity(this.hand.getAbsolutePosition().subtract(this.heldMesh.getAbsolutePosition()).scale(20));

            if (this.input.justPressed["interact"] && this.isHoldingMesh) {
                this.dropHeldMesh(aggregate);
                return;
            }
            this.isHoldingMesh = true;
        }
    }

    dropHeldMesh(aggregate) {
        if (this.heldMesh) {
            if (aggregate == undefined) {
                aggregate = this.heldMesh.metadata.boxAggregate;
            }
            aggregate.body.setLinearVelocity(this.hand.getAbsolutePosition().subtract(this.heldMesh.getAbsolutePosition()).scale(2));
            this.heldMesh = null;
            this.isHoldingMesh = false;
        }
    }

    grapplingHook() {
        if (!this.playerData.hasGrapplingHook) {
            return;
        }
        if (this.grapplingHookTimer > 0) {
            this.grapplingHookTimer -= this.deltaTime;
        }
        if (this.grapplingHookTimer <= 0) {
            this.line = BABYLON.MeshBuilder.CreateLines("grapplingHook", { points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()], updatable: true, instance: this.line });
            if (this.input.justPressed["mouseLeft"] && !this.isHoldingMesh && this.scene.alreadyLocked) {
                this.grapplingHookTimer = this.GRAPPLING_HOOK_COOLDOWN;
                this.updateRayPos(this.grapplingHookRay)
                this.checkgrapplingHookRayHit(this.grapplingHookRay);
            }
        }
    }

    checkgrapplingHookRayHit(ray) {
        const pickInfo = this.scene.pickWithRay(ray);

        if (pickInfo.hit) {
            let temp = this.velocity.clone().addInPlace(pickInfo.ray.direction.scale(30));
            if (temp.y > 10) {
                temp.y = 10;
                this.velocity.copyFrom(temp);
            }
            else if (temp.y < -10) {
                temp.y = -10;
                this.velocity.copyFrom(temp);
            }
            else {
                this.velocity.addInPlace(pickInfo.ray.direction.scale(30));
            }
            this.lowFriction = true
            // A FAIRE tester d'enlever une direction x ou z pour regler bug qui bloque hauteur quand contre mur

            this.line = BABYLON.MeshBuilder.CreateLines("grapplingHook", { points: [this.character._position, pickInfo.pickedPoint], updatable: true, instance: this.line });
        }
    }

    respawn() {
        const respawnPlayer = () => {
            this.dropHeldMesh();
            this.character.setPosition(this.respawnPos);
            this.velocity = BABYLON.Vector3.Zero();
            this.head.rotation.y = this.respawnRotation;
            this.camera.rotation.x = 0;
        }
        fade(respawnPlayer)
    }

    lerpCameraTo(fov) {
        this.camera.fov = BABYLON.Lerp(this.camera.fov, fov, this.deltaTime * 5.0);
    }

    applyCeilingHitModification() {
        if (!this.isGrounded && this.velocity.y > 0.1) {
            if (Math.abs(this.lastY - this.character._position.y) < 0.001) {
                this.lastYCounter += 1
            }
            else {
                this.lastYCounter = 0
            }
            if (this.lastYCounter >= 2) {
                this.lastYCounter = 0
                this.velocity.y = 0
            }
            this.lastY = this.character._position.y
        }
    }
}