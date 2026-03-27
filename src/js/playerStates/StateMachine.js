import { StandState } from "./StandState.js";
import { DialogState } from "./DialogState.js";

export class StateMachine {
    constructor(player) {
        this.player = player;
        this.states = {
            stand: new StandState(player, this),
            dialog: new DialogState(player, this),
        };
        this.currentState = this.states.stand;
        this.ready()
    }

    ready() {
        for (const [_, value] of Object.entries(this.states)) {
            value.setStates()
        }
    }

    update() {
        if (this.currentState.nextState != null) {
            this.switchState(this.currentState.nextState)
        }
        this.currentState.update();
    }

    checkIfCanMove() {
        return this.currentState.canMove
    }

    switchState(newState, onEnter) {
        if (this.currentState) {
            this.currentState.exit();
            this.currentState.nextState = null;
        }

        this.currentState = newState;
        this.currentState.enter(onEnter);
    }

}