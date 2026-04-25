
export class Destination {
    constructor(main, position, rotation, canBeRewired) {
        this.type = "destination"
        this.main = main
        this.position = position
        this.rotation = rotation
        this.canBeRewired = canBeRewired;
        this.connectedTo = null
        if (canBeRewired) {
            this.main.player.connectionManager.connectables.push(this)
        }
    }

    onConnect(target) {
        this.connectedTo = target;
    }

    onDisconnect() {
        this.deactivate();
        this.connectedTo = null
    }

    activate() {
    }

    deactivate() {
    }
}