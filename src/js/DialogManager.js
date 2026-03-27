export class DialogManager {
    constructor() {
        this.lineIndex = 0
        this.dialog = {
            "testDialog": [
                {
                    text: "test message 1",
                },
                {
                    text: "test message 2",
                },
                {
                    text: "test message 3",
                    action: () => this.currentDialog = "Dialog2"
                }
            ],
            "Dialog2": [
                {
                    text: "Dialog2  1",
                },
                {
                    text: "Dialog2  2",
                },
                {
                    text: "Dialog2  3",
                    action: () => console.log("fin !")
                }
            ],
        }
        this.currentDialog = "testDialog"
        this.updateCurrentLine()
    }

    nextLine() {
        if (this.lineIndex + 1 >= this.dialog[this.currentDialog].length) {
            return false
        }
        else {
            this.lineIndex++
            this.updateCurrentLine()
            if (this.dialog[this.currentDialog][this.lineIndex].action) {
                this.dialog[this.currentDialog][this.lineIndex].action()
            }
            return true
        }
    }

    resetDialog() {
        this.lineIndex = 0
        this.updateCurrentLine()
    }

    updateCurrentLine() {
        this.currentLine = this.dialog[this.currentDialog][this.lineIndex].text
    }
}
