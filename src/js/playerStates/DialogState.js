import { State } from "./State.js";
import { DialogManager } from "../DialogManager.js";

export class DialogState extends State {
    constructor(player, stateMachine) {
        super();
        this.player = player;
        this.stateMachine = stateMachine;
        this.canMove = false;
        this.dialogManager = new DialogManager(player.main)
    }

    setStates() {
        this.standState = this.stateMachine.states.stand;
    }

    enter(functions) {
        // console.log("Enter Dialog");
        dialogBox.style.display = "block"
        dialogCrosshair.style.display = "none"
        dialogBox.innerText = this.dialogManager.currentLine
        functions[0]()
        this.onExit = functions[1]
    }

    update() {
        if (this.player.input.justPressed["interact"]) {
            if (this.dialogManager.nextLine()) {
                dialogBox.innerText = this.dialogManager.currentLine
            }
            else {
                this.stateMachine.switchState(this.standState)
                this.player.input.justPressed["interact"] = false
            }
        }
    }

    exit() {
        // console.log("Exit Dialog");
        dialogBox.style.display = "none"
        this.dialogManager.resetDialog()
        this.onExit()
    }
}