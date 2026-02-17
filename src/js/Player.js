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

        this.velocity = new BABYLON.Vector3(0, 0, 0);

        this.SPEED = 5;
        this.JUMP_FORCE = 4.5;
        this.GRAVITY = -9.81;
        this.SENSITIVITY = 0.0006;

        this.isGrounded = false;

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
        let playerDepth = 1

        this.player = BABYLON.MeshBuilder.CreateBox(
            "player",
            { width: playerWidth, depth: playerDepth, height: playerHeight },
            this.scene
        );

        this.player.ellipsoid = new BABYLON.Vector3((playerWidth / 2), (playerHeight / 2), (playerDepth / 2));

        this.player.isVisible = true;

        this.player.checkCollisions = true;
        // a faire enlever les checkCollisions et changer fonction updateFromControls pour utiliser les forces sur le this.playerAggregate.body

        this.player.position = new BABYLON.Vector3(0, 2, -10);

        // pour l'instant player Aggregate inutile 
        // this.playerAggregate = new BABYLON.PhysicsAggregate(this.player, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: 0.7, restitution: 0.2 }, this.scene);
        // this.playerAggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
        // this.playerAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);

        this.head = new BABYLON.TransformNode("head", this.scene);
        this.head.position.y = 0.8;
        this.head.parent = this.player;

        this.camera = new BABYLON.FreeCamera("camera", BABYLON.Vector3.Zero(), this.scene);
        this.camera.minZ = 0.1;
        this.camera.fov = 1

        // a tester si c'est utile ?
        this.camera.speed = 0.6;
        this.camera.angularSensibility = 3000;
        this.camera.inertia = 0.7;

        this.floorRay = new BABYLON.Ray(this.player.position, BABYLON.Vector3.Down(), (playerHeight / 2) + 0.05);
        this.floorRay.parent = this.player;  // pas utile ?
        
        // var rayHelper = new BABYLON.RayHelper(this.floorRay);
        // rayHelper.show(this.scene);
        
        this.camera.parent = this.head;

        // // temp camera pour debug commenter la ligne au dessus aussi
        // this.camera.attachControl(this.canvas);
        // this.camera.position = new BABYLON.Vector3(-11, 1.8, -9.8)
        // this.camera.setTarget(this.player.position)
    }

    beforeRenderUpdate() {
        this.deltaTime = this.map.deltaTime;
        this.updateFromControls()
    }

    updateFromControls() {
        if (!this.isGrounded) {
            this.velocity.y += this.GRAVITY * this.deltaTime;
        }
        if (this.input.inputMap["Space"] && this.isGrounded) {
            this.velocity.y = this.JUMP_FORCE;
            this.isGrounded = false;
        }

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

        this.velocity.x = move.x * this.SPEED;
        this.velocity.z = move.z * this.SPEED;

        this.player.moveWithCollisions(
            this.velocity.scale(this.deltaTime)
        );

        this.checkGround();

        // debug
        if (this.input.test){
            console.log(this.player)
        }
    }

    checkGround() {
        let predicate = function(mesh) {
            if (mesh.name.includes("player")){
                return false;
            }
            else if (mesh.isPickable){
                return true;
            }
        }

        let hit = this.scene.pickWithRay(this.floorRay, predicate);

        if (hit.hit) {
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }
    }

}