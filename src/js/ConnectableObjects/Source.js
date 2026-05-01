
export class Source {
    constructor(main, position, rotation, canBeRewired, connectedTo = null) {
        this.type = "source"
        this.main = main
        this.position = position
        this.rotation = rotation
        this.canBeRewired = canBeRewired;
        this.connectionManager = this.main.player.connectionManager
        if (connectedTo) {
            this.connectionManager.connect(this, connectedTo)
        }
        if (canBeRewired) {
            this.connectionManager.connectables.push(this)
        }
    }
    
    onConnect(target) {
        this.connectedTo = target;
    }

    onDisconnect() {
        this.deactivate();
        this.connectedTo = null;
    }

    activate() {
        if (this.connectedTo) {
            this.connectedTo.activate();
        }
    }

    deactivate() {
        if (this.connectedTo) {
            this.connectedTo.deactivate();
        }
    }
}