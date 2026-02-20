import * as BABYLON from '@babylonjs/core'

import { PlayerInput } from "./PlayerInput.js";

export class Player {

    constructor(scene, canvas, map, SPAWN_POS, SPAWN_ROTATION) {
        this.isGrounded = false;
        this.groundDisableTimer = 0;
        this.jumpBufferTimer = 0;
        this.velocity = new BABYLON.Vector3(0, 0, 0);

        this.scene = scene;
        this.canvas = canvas;
        this.map = map;
        this.GRAVITY = this.map.scene._physicsEngine.gravity;

        this.SPEED = 5.7;
        this.JUMP_FORCE = 4.7;
        this.SENSITIVITY = 0.0008;
        this.MAX_SLOPE_ANGLE = 60;

        this.GROUND_DISABLE_TIME = 0.1;
        this.JUMP_BUFFER_TIME = 0.15;

        this.createPlayer(SPAWN_POS, SPAWN_ROTATION)
        this.cameraRotation()

        this.input = new PlayerInput(scene);
    }


    cameraRotation() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && this.scene.alreadyLocked) {
                const event = pointerInfo.event;

                this.head.rotation.y += event.movementX * this.SENSITIVITY;
                this.camera.rotation.x += event.movementY * this.SENSITIVITY;

                this.camera.rotation.x = BABYLON.Scalar.Clamp(this.camera.rotation.x, -Math.PI / 2, Math.PI / 2);
            }
        });
    }

    createPlayer(SPAWN_POS, SPAWN_ROTATION) {
        let playerHeight = 1.8
        let playerWidth = 1
        if (SPAWN_POS == undefined) {
            SPAWN_POS = new BABYLON.Vector3(0, 3, 0)
        }

        this.player = new BABYLON.TransformNode("player", this.scene);
        // this.player = BABYLON.MeshBuilder.CreateCapsule("player", { height: playerHeight, radius: playerWidth / 2 }, this.scene);

        this.player.isVisible = false;
        this.player.position = SPAWN_POS;

        this.character = new BABYLON.PhysicsCharacterController(SPAWN_POS, { capsuleHeight: (playerHeight - 0.3), capsuleRadius: (playerWidth / 2) }, this.scene);

        this.head = new BABYLON.TransformNode("head", this.scene);
        this.head.position.y = 0.8;
        if (SPAWN_ROTATION == undefined) {
            SPAWN_ROTATION = new BABYLON.Vector3(0, 0, 0)
        }
        this.head.rotation = SPAWN_ROTATION
        this.head.parent = this.player;

        this.camera = new BABYLON.FreeCamera("camera", BABYLON.Vector3.Zero(), this.scene);
        this.camera.minZ = 0.1;
        this.camera.fov = 1.1

        // a tester si c'est utile ?
        this.camera.speed = 0.6;
        this.camera.angularSensibility = 3000;
        this.camera.inertia = 0.7;

        this.camera.parent = this.head;

        // // temp camera pour debug commenter la ligne au dessus aussi
        // this.camera.attachControl(this.canvas);
        // this.camera.position = new BABYLON.Vector3(-6, 6, -13.8)
        // this.camera.setTarget(this.player.position)
    }

    // fonction appelé à chaque frame
    beforeRenderUpdate() {
        this.deltaTime = this.map.deltaTime;
        this.updateGrounded()
        this.applyGravity()
        this.updateFromControls()
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

        // jump
        if (this.input.justPressed["Space"]) {
            this.jumpBufferTimer = this.JUMP_BUFFER_TIME;
        }
        if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer -= this.deltaTime;
        }
        if (this.jumpBufferTimer > 0 && this.isGrounded) {
            this.velocity.y = this.JUMP_FORCE;
            this.isGrounded = false
            this.groundDisableTimer = this.GROUND_DISABLE_TIME;
            this.jumpBufferTimer = 0;
        }

        // apply movement
        if (this.isGrounded) {
            if (move.length() > 0) {
                this.velocity.x = move.x * this.SPEED;
                this.velocity.z = move.z * this.SPEED;
            }
            else {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        }
        else if (move.length() > 0) {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.SPEED, this.deltaTime * 3);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.SPEED, this.deltaTime * 3);
        }
        else {
            this.velocity.x = BABYLON.Lerp(this.velocity.x, move.x * this.SPEED, this.deltaTime * 10);
            this.velocity.z = BABYLON.Lerp(this.velocity.z, move.z * this.SPEED, this.deltaTime * 10);
        }

        this.character.moveWithCollisions(this.velocity.scale(this.deltaTime));
        this.player.position.copyFrom(this.character.getPosition());

        // debug
        if (this.input.justPressed["KeyP"]) {
            console.log(this.player._position)
            // console.log(this.velocity.z);
            // console.log(this.camera.position);
        }
    }

    applyRampModification(move) {
        if (this.isGrounded && this.groundNormal.y != 1) {
            move = this.projectOnPlane(move, this.groundNormal).normalize();

            const angle = Math.acos(BABYLON.Vector3.Dot(this.groundNormal, BABYLON.Vector3.Up()));
            const angleDeg = BABYLON.Tools.ToDegrees(angle);

            if (this.isGrounded && angleDeg < this.MAX_SLOPE_ANGLE) {
                if (move.y < 0) {
                    this.velocity.y += move.y * this.SPEED;
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
        if (!this.isGrounded) {
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
            this.isGrounded = true
            this.groundNormal = this.supportInfo.averageSurfaceNormal;
        }
        else {
            this.isGrounded = false
            this.groundNormal = null;
        }
    }

}