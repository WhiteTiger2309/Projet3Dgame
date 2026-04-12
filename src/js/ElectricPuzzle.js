import * as BABYLON from '@babylonjs/core'
import { createBox } from './utils/utils.js';

export class ElectricPuzzle {
    constructor(main, pos) {
        this.scene = main.scene
        this.main = main
        this.pos = pos
        this.conductiveObjects = []

        this.grid =
            [[4, 1, 1, 3, 3],
            [0, 0, 0, 0, 2],
            [0, 0, 0, 0, 5]]

        this.grid2 = []

        this.createPuzzle2(pos)
        this.createPuzzle(pos)

    }

    createPuzzle2(pos) {
        const pos2 = pos.clone();

        pos2.z -= 3.5 
        this.box = createBox(this.main, pos2, 1)

        this.conductiveObjects.push(this.box)

    }

    createPuzzle(pos) {
        const defaultPos = pos.clone()
        for (let i = 0; i < this.grid.length; i++) {
            this.grid2[i] = [];
            for (let j = 0; j < this.grid[i].length; j++) {
                const val = this.grid[i][j];
                let obj = null;
                if (val != 0) {
                    obj = this.createCell(val)
                    obj.position = pos.clone();
                }
                this.grid2[i][j] = {
                    type: val,
                    powered: val === 4,
                    mesh: obj,
                    neighbors: []
                }
                pos.x -= 1
            }
            pos.x = defaultPos.x
            pos.z += 1
        }
        this.buildNeighbors()
    }

    createCell(val) {
        switch (val) {
            case 1:
                return BABYLON.MeshBuilder.CreateBox("cableH", { width: 1, depth: 0.2, height: 0.1 }, this.scene);

            case 2:
                return BABYLON.MeshBuilder.CreateBox("cableV", { width: 0.2, depth: 1, height: 0.1 }, this.scene);

            case 3:
                return BABYLON.MeshBuilder.CreateBox("connector", { width: 0.5, depth: 0.5, height: 0.5 }, this.scene);

            case 4:
                return BABYLON.MeshBuilder.CreateBox("source", { width: 1, depth: 1, height: 1 }, this.scene);

            case 5:
                return BABYLON.MeshBuilder.CreateBox("destination", { width: 1, depth: 1, height: 1 }, this.scene);

            default:
                return null;
        }
    }

    buildNeighbors() {
        for (let i = 0; i < this.grid2.length; i++) {
            for (let j = 0; j < this.grid2[0].length; j++) {
                const cell = this.grid2[i][j];
                if (cell.type === 0) continue;

                // haut
                if (i > 0 && this.canConnect(cell, this.grid2[i - 1][j])) {
                    cell.neighbors.push(this.grid2[i - 1][j])
                }
                // bas
                if (i < this.grid2.length - 1 && this.canConnect(cell, this.grid2[i + 1][j])) {
                    cell.neighbors.push(this.grid2[i + 1][j])
                }
                // gauche
                if (j > 0 && this.canConnect(cell, this.grid2[i][j - 1])) {
                    cell.neighbors.push(this.grid2[i][j - 1])
                }
                // droite
                if (j < this.grid2[0].length - 1 && this.canConnect(cell, this.grid2[i][j + 1])) {
                    cell.neighbors.push(this.grid2[i][j + 1])
                }
            }
        }
    }

    canConnect(a, b) {
        if (a.type == 1 && (b.type == 1 || b.type == 3 || b.type == 5)) {
            return true;
        }
        if (a.type == 2 && (b.type == 2 || b.type == 3 || b.type == 5)) {
            return true;
        }
        if (a.type == 3 && (b.type == 1 || b.type == 2)) {
            return true;
        }
        if (a.type == 4 && (b.type == 1 || b.type == 2)) {
            return true;
        }
        return false;
    }

    updateElectricity() {
        // reset
        const connectors = []
        const queue = []

        for (let row of this.grid2) {
            for (let cell of row) {
                if (cell.type == 3) {
                    connectors.push(cell)
                }
                if (cell.type == 4) {
                    queue.push(cell);
                }
                else {
                    cell.powered = false;
                }
            }
        }

        while (queue.length > 0) {
            const current = queue.shift();

            if (current.type == 3) {
                this.conductiveObjects.forEach(element => {
                    element.metadata.powered = false
                    const dist = BABYLON.Vector3.Distance(current.mesh.position, element.position);
                    if (dist < 1.5) {
                        element.metadata.powered = true
                        connectors.filter(c => !c.powered).forEach(connector => {
                            const dist2 = BABYLON.Vector3.Distance(connector.mesh.position, element.position);
                            if (dist2 < 1.5) {
                                queue.push(connector);
                            }

                        });
                    }
                });
            }
            for (let neighbor of current.neighbors) {
                if (!neighbor.powered) {

                    neighbor.powered = true;
                    queue.push(neighbor);
                }
            }
        }

        for (let row of this.grid2) {
            for (let cell of row) {
                if (cell.mesh) {
                    cell.mesh.material = cell.powered ? this.main.materials["electric"] : this.main.materials["nonElectric"];
                }
            }
        }
        this.conductiveObjects.forEach(element => {
            if (element.metadata.powered) {
                element.material = this.main.materials["electric"];
            }
            else {
                element.material = this.main.materials["nonElectric"];
            }
        });
    }
}