import { State } from "./State.js";

export class StandState extends State {
    constructor(player, stateMachine) {
        super();
        this.player = player;
        this.stateMachine = stateMachine;
        this.canMove = true;
    }

    setStates() {
        this.dialogState = this.stateMachine.states.dialog;
    }

    enter() {
        console.log("Enter Stand");
    }

    update() {
        if (this.player.playerData.canJump) {
            if (this.player.input.justPressed["jump"]) {
                this.player.jumpBufferTimer = this.player.JUMP_BUFFER_TIME;
            }
            if (this.player.jumpBufferTimer > 0) {
                this.player.jumpBufferTimer -= this.player.deltaTime;
            }
            if ((this.player.jumpBufferTimer > 0 && this.player.isGrounded) || (this.player.input.justPressed["jump"] && this.player.coyoteJumpTimer > 0)) {
                this.player.inheritedVelocity.copyFrom(this.player.supportInfo.averageSurfaceVelocity);
                this.player.velocity.addInPlace(this.player.inheritedVelocity);
                if (this.player.velocity.y < 0) {
                    this.player.velocity.y = this.player.JUMP_FORCE;
                }
                else {
                    this.player.velocity.y += this.player.JUMP_FORCE;
                }
                this.player.isGrounded = false;
                this.player.groundDisableTimer = this.player.GROUND_DISABLE_TIME;
                this.player.jumpBufferTimer = 0;
                this.player.coyoteJumpTimer = 0
            }
        }
    }

    exit() {
        console.log("Exit Stand");
    }
}