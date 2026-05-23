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
            "DialogLazer1": [
                {
                    text: "Bienvenue dans la première salle laser.",
                },
                {
                    text: "Regarde cet objet, il envoie un faisceau laser. Essaie de le guider jusqu'au capteur.",
                },
                {
                    text: "Intéragis avec et déplace le rayon avec les flèches directionnelles.",
                }
            ],
            "DialogLazer2": [
                {
                    text: "Ici, le miroir fixe fait le renvoi principal.",
                },
                {
                    text: "Place-toi pour bien viser le rebond et atteindre le capteur au fond de la salle.",
                }
            ],
            "DialogLazer3": [
                {
                    text: "Le prisme se comporte différemment d'un miroir.",
                },
                {
                    text: "Il faut séparer le faisceau et alimenter les deux capteurs pour ouvrir la suite.",
                }
            ],
            "DialogLazer4": [
                {
                    text: "Dernière salle laser: il faut combiner les deux mécaniques.",
                },
                {
                    text: "Commence par réactiver l'émetteur laser, puis guide le faisceau avec les miroirs inclinables jusqu'au capteur.",
                }
            ],
            "DialogFin": [
                {
                    text: "Bravo, tu as réussi à résoudre tous les puzzles et à atteindre la fin du jeu.",
                },
                {
                    text: "Prend ce téléporteur pour revenir au menu principal.",
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
