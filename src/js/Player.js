import * as BABYLON from '@babylonjs/core'

import { PlayerInput } from "./PlayerInput.js";

export class Player {
    scene;
    canvas;
    camera;
    input;
    deltaTime;
    map;

    constructor(scene, canvas, map) {
        this.scene = scene;
        this.canvas = canvas;
        this.map = map;
        this.GRAVITY = this.map.scene._physicsEngine.gravity;

        this.SPEED = 5.7;
        this.JUMP_FORCE = 4.7;
        this.SENSITIVITY = 0.0008;
        this.MAX_SLOPE_ANGLE = 60;

        this.isGrounded = false;

        this.velocity = new BABYLON.Vector3(0, 0, 0);

        this.createPlayer()
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

    createPlayer() {
        let playerHeight = 1.8
        let playerWidth = 1
        let defaultPos = new BABYLON.Vector3(0, 3, -14)

        this.player = new BABYLON.TransformNode("playerRoot", this.scene);
        // this.player = BABYLON.MeshBuilder.CreateCapsule("player", { height: playerHeight, radius: playerWidth / 2 }, this.scene);
        // this.player.isVisible = true;

        this.player.position = defaultPos;

        this.character = new BABYLON.PhysicsCharacterController(defaultPos, { capsuleHeight: (playerHeight - 0.3), capsuleRadius: (playerWidth / 2) }, this.scene);

        this.head = new BABYLON.TransformNode("head", this.scene);
        this.head.position.y = 0.8;
        this.head.parent = this.player;

        this.camera = new BABYLON.FreeCamera("camera", BABYLON.Vector3.Zero(), this.scene);
        this.camera.minZ = 0.1;
        this.camera.fov = 1.1

        // a tester si c'est utile ?
        this.camera.speed = 0.6;
        this.camera.angularSensibility = 3000;
        this.camera.inertia = 0.7;

        this.camera.parent = this.head;

        // this.camera.position = new BABYLON.Vector3(-11, 1.8, -14.8)
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

        // // pour les pentes
        if (this.isGrounded && this.groundNormal) {
            const projected = this.projectOnPlane(move, this.groundNormal);
            projected.normalize();
            move = projected;
        }

        if (this.isGrounded && this.groundNormal) {
            // a mettre dans utils ?
            const angle = Math.acos(BABYLON.Vector3.Dot(this.groundNormal, BABYLON.Vector3.Up()));
            const angleDeg = BABYLON.Tools.ToDegrees(angle);

            if (angleDeg < this.MAX_SLOPE_ANGLE && this.isGrounded) {
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

        // jump
        if (this.input.inputMap["Space"] && this.isGrounded) {
            // this.velocity.y += this.JUMP_FORCE;  // permet des super saut  à fix   surtout avec le bloc
            this.velocity.y = this.JUMP_FORCE;  // bloque les saut pendant la monté
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
        if (this.input.test) {
            // console.log(this.player._position)
            // console.log(this.velocity.y);
            console.log("test");
            // console.log(this.camera.position);
        }
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
        this.supportInfo = this.character.checkSupport(this.deltaTime, this.GRAVITY.normalizeToNew());
        if (this.supportInfo.supportedState === BABYLON.CharacterSupportedState.SUPPORTED) {
            // console.log(supportInfo.averageSurfaceVelocity)
            this.isGrounded = true
            this.groundNormal = this.supportInfo.averageSurfaceNormal;
        }
        else {
            this.isGrounded = false
            this.groundNormal = null;
        }
    }

}