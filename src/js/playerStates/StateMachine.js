import { StandState } from "./StandState.js";
import { OtherState } from "./OtherState.js";

export class StateMachine {
    constructor(player) {
        this.player = player;
        this.states = {
            stand: new StandState(player, this),
            other: new OtherState(player, this),
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

    switchState(newState) {
        if (this.currentState) {
            this.currentState.exit();
            this.currentState.nextState = null;
        }

        this.currentState = newState;
        this.currentState.enter();
    }

}