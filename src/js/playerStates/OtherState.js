import { State } from "./State.js";

export class OtherState extends State {
    constructor(player, stateMachine) {
        super();
        this.player = player;
        this.stateMachine = stateMachine;
        this.canMove = false;
    }

    setStates() {
        this.standState = this.stateMachine.states.stand;
    }

    enter() {
        console.log("Enter Other");
        this.player.isSprinting = false
    }

    update() {
        if (this.player.input.justPressed["KeyO"]) {
            this.player.stateMachine.currentState.nextState = this.standState
        }
        this.player.lerpCameraTo(this.player.BASE_FOV);
    }

    exit() {
        console.log("Exit Other");
    }
}