export class PlayerInput {

    constructor(scene) {
        scene.actionManager = new BABYLON.ActionManager(scene);

        this.inputMap = {};
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
            const code = evt.sourceEvent.code;
            this.inputMap[code] = true;
        }));
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            const code = evt.sourceEvent.code;
            this.inputMap[code] = false;
        }));

        scene.onBeforeRenderObservable.add(() => {
            this.updateFromKeyboard();
        });
    }

    updateFromKeyboard() {
        if (this.inputMap["KeyW"]) {
            this.vertical = BABYLON.Scalar.Lerp(this.vertical, 1, 0.2);
            this.verticalAxis = 1;

        } else if (this.inputMap["KeyS"]) {
            this.vertical = BABYLON.Scalar.Lerp(this.vertical, -1, 0.2);
            this.verticalAxis = -1;
        } else {
            this.vertical = 0;
            this.verticalAxis = 0;
        }

        if (this.inputMap["KeyA"]) {
            this.horizontal = BABYLON.Scalar.Lerp(this.horizontal, -1, 0.2);
            this.horizontalAxis = -1;

        } else if (this.inputMap["KeyD"]) {
            this.horizontal = BABYLON.Scalar.Lerp(this.horizontal, 1, 0.2);
            this.horizontalAxis = 1;
        }
        else {
            this.horizontal = 0;
            this.horizontalAxis = 0;
        }

        // temp pour debug
        if (this.inputMap["KeyP"] && this.test == false) {
            this.test = true
        }
        else{
            this.test = false
        }
    }

}