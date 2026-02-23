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
    }

    update() {
        if (this.player.input.justPressed["KeyO"]) {
            this.player.stateMachine.currentState.nextState = this.standState
        }
    }

    exit() {
        console.log("Exit Other");
    }
}