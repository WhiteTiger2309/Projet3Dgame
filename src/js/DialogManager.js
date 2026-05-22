export class DialogManager {
    constructor(main) {
        this.lineIndex = 0
        this.dialog = {
            "Dialog1": [
                {
                    text: "Tu m'as libéré.",
                },
                {
                    text: "Je vais t'ouvrir la porte.",
                },
                {
                    action: () => {
                        main.map.robot.activateDoor()
                        this.changeDialog("Dialog2")
                    }
                }
            ],
            "Dialog2": [
                {
                    text: "Et voilà.",
                }
            ],
            "DialogTuto": [
                {
                    text: "Tu peux maintenant appuyer sur A pour passer en mode lien.",
                },
                {
                    text: "Une fois en mode lien, tu peux appuyer sur clic gauche en visant un objet pour le sélectionner, ce qui crée un lien. Lorsque tu sélectionnes un deuxième objet, ils seront liés.",
                },
                {
                    text: "Tu peux uniquement relier des objets entourés de rouge qui sont des interrupteurs ou des plaques aux portes entourées de vert.",
                }
            ],
        }
        this.changeDialog("Dialog1")
    }

    nextLine() {
        let res = false
        if (this.lineIndex + 1 >= this.dialog[this.currentDialog].length) {
            return false
        }
        else {
            this.lineIndex++
            this.updateCurrentLine()
            if (this.currentLine) {
                res = true
            }
            if (this.dialog[this.currentDialog][this.lineIndex].action) {
                this.dialog[this.currentDialog][this.lineIndex].action()
            }
            return res
        }
    }

    resetDialog() {
        this.lineIndex = 0
        this.updateCurrentLine()
    }

    updateCurrentLine() {
        this.currentLine = this.dialog[this.currentDialog][this.lineIndex].text
    }

    changeDialog(dialogName) {
        this.currentDialog = dialogName
        this.resetDialog()
    }
}
