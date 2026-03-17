import { State } from "./State.js";

export class StandState extends State {
    constructor(player, stateMachine) {
        super();
        this.player = player;
        this.stateMachine = stateMachine;
        this.canMove = true;
    }

    setStates() {
        this.otherState = this.stateMachine.states.other;
    }

    enter() {
        console.log("Enter Stand");
    }

    update() {
        if (this.player.input.justPressed["jump"]) {
            this.player.jumpBufferTimer = this.player.JUMP_BUFFER_TIME;
        }
        if (this.player.jumpBufferTimer > 0) {
            this.player.jumpBufferTimer -= this.player.deltaTime;
        }
        if (this.player.jumpBufferTimer > 0 && this.player.isGrounded) {
            this.player.inheritedVelocity.copyFrom(this.player.supportInfo.averageSurfaceVelocity);
            this.player.velocity.addInPlace(this.player.inheritedVelocity);

            this.player.velocity.y += this.player.JUMP_FORCE;
            this.player.isGrounded = false;
            this.player.groundDisableTimer = this.player.GROUND_DISABLE_TIME;
            this.player.jumpBufferTimer = 0;
        }
        else if (this.player.input.justPressed["sprint"] && !this.player.isSprinting && this.player.input.inputMap["forward"]) {
            this.player.isSprinting = true;
            this.player.speed = this.player.SPRINT_SPEED;
            this.player.fov = this.player.SPRINT_FOV;
        }
        else if ((this.player.input.inputMap["left"] || this.player.input.inputMap["right"] || this.player.input.inputMap["backward"]) && !this.player.input.inputMap["forward"]) {
            this.player.isSprinting = false;
            this.player.speed = this.player.WALK_SPEED;
            this.player.fov = this.player.BASE_FOV;
        }
        else if (this.player.input.justPressed["sprint"] && this.player.isSprinting) {
            this.player.isSprinting = false;
            this.player.speed = this.player.WALK_SPEED;
            this.player.fov = this.player.BASE_FOV;
        }
        else if (!this.player.isSprinting) {
            this.player.speed = this.player.WALK_SPEED;
            this.player.fov = this.player.BASE_FOV;
        }
    }

    exit() {
        console.log("Exit Stand");
    }
}