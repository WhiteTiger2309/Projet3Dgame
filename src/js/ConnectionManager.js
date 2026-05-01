import * as BABYLON from '@babylonjs/core'

export class ConnectionManager {
    constructor(main, player) {
        this.main = main
        this.player = player
        this.scene = main.scene

        this.firstSelected = null;
        this.isInConnectionMode = false
        this.lines = [];
        this.connectables = [];
        this.previewLine = BABYLON.MeshBuilder.CreateLines("preview", {
            points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()],
            updatable: true
        }, this.scene);
        this.previewLine.color = new BABYLON.Color3(0, 1, 1);

        this.ray = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero(), 20);

        this.highlightLayer = new BABYLON.HighlightLayer("hl", this.scene);

        this.outliner = new BABYLON.SelectionOutlineLayer("outliner", this.scene)
        this.outliner.outlineColor = BABYLON.Color3.White()
        this.outliner.outlineThickness = 3.0;

    }

    update() {
        this.updateMode()
        if (this.isInConnectionMode) {
            this.interactionUpdate()
        }
    }

    updateMode() {
        if (this.player.input.justPressed["switchMode"]) {
            if (this.isInConnectionMode) {
                this.exitConnectionMode()
            }
            else {
                this.enterConnectionMode()
            }
        }
    }

    enterConnectionMode() {
        this.isInConnectionMode = true

        // peut etre changer pour juste rendre visible / invisible
        this.connectables.forEach(connectable => {
            this.highlightLayer.addMesh(connectable.mesh, BABYLON.Color3.Green());
        });
        this.lines.forEach(line => {
            line.mesh.isVisible = true
        })
    }
    exitConnectionMode() {
        this.firstSelected = null;
        this.isInConnectionMode = false
        this.highlightLayer.removeAllMeshes();
        this.lines.forEach(line => {
            line.mesh.isVisible = false
        })
        this.previewLine.isVisible = false
    }

    interactionUpdate() {
        this.player.updateRayPos(this.ray)
        const pickInfo = this.updatePickInfo(this.ray)
        if (!this.player.isHoldingMesh) {
            if (pickInfo.hit && pickInfo.pickedMesh?.metadata?.connectable) {
                const obj = pickInfo.pickedMesh.metadata.connectable;
                if (obj.canBeRewired) {
                    // effet sur le mesh a changer pour cercle surement
                    this.outliner.addSelection(pickInfo.pickedMesh);
                    if (this.player.input.justPressed["mouseLeft"] && this.scene.alreadyLocked) {
                        this.select(obj);
                    }
                }
            }
            else {
                this.outliner.clearSelection();
            }
        }
        if (this.firstSelected) {
            this.previewLine.isVisible = true
            const start = this.firstSelected.mesh.getAbsolutePosition();
            const end = pickInfo.pickedPoint ?? this.ray.origin.add(this.ray.direction.scale(10));

            const points = [start, end];
            BABYLON.MeshBuilder.CreateLines(null, { points: points, instance: this.previewLine });
        }
        else {
            this.previewLine.isVisible = false
        }
    }

    updatePickInfo(ray) {
        return this.scene.pickWithRay(ray, (mesh) => {
            return (!(mesh.physicsBody?.shape.isTrigger) && mesh.getClassName() !== "LinesMesh");
        });
    }

    select(obj) {
        if (!this.firstSelected) {
            this.disconect(obj);
            this.firstSelected = obj;
            console.log("First selected:", obj);
        } else {
            this.connect(this.firstSelected, obj);
            this.firstSelected = null;
        }
    }

    connect(a, b) {
        if (a.type === b.type) {
            console.log("Connexion invalide");
            return;
        }
        this.disconect(b);

        let emitter = a.type === "source" ? a : b;
        let receiver = a.type === "destination" ? a : b;

        emitter.onConnect(receiver);
        receiver.onConnect(emitter);

        if (a.canBeRewired || b.canBeRewired) {
            this.createConnectionLine(emitter, receiver)
        }

        console.log("Connected:", emitter, "->", receiver);
    }

    disconect(obj) {
        this.removeLinesOf(obj);
        if (obj.connectedTo) {
            obj.connectedTo.onDisconnect();
        }
        obj.onDisconnect();
    }

    createConnectionLine(a, b) {
        const points = [
            a.position,
            b.position
        ];

        const line = BABYLON.MeshBuilder.CreateLines("connectionLine", { points: points, updatable: true }, this.scene);

        line.color = new BABYLON.Color3(1, 1, 0);
        if (!this.isInConnectionMode) {
            line.isVisible = false
        }

        this.lines.push({ mesh: line, a: a, b: b });
    }

    removeLinesOf(obj) {
        this.lines = this.lines.filter(l => {
            if (l.a === obj || l.b === obj) {
                l.mesh.dispose();
                return false;
            }
            return true;
        });
    }
}