import * as BABYLON from '@babylonjs/core'

export class PlayerInput {

    constructor(scene) {
        scene.actionManager = new BABYLON.ActionManager(scene);

        this.inputMap = {};
        this.justPressed = {};
        this.vertical = 0;
        this.verticalAxis = 0;
        this.horizontal = 0;
        this.horizontalAxis = 0;

        this._onKeyDown = (evt) => {
            const code = evt.code;
            if (!this.inputMap[code]) {
                this.justPressed[code] = true;
            }
            this.inputMap[code] = true;
        };

        this._onKeyUp = (evt) => {
            const code = evt.code;
            this.inputMap[code] = false;
        };

        // Fallback global: plus robuste avec pointer lock/focus navigateur.
        window.addEventListener("keydown", this._onKeyDown);
        window.addEventListener("keyup", this._onKeyUp);

        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
            const code = evt.sourceEvent.code;
            if (!this.inputMap[code]) {
                this.justPressed[code] = true;
            }
            this.inputMap[code] = true;
        }));
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            const code = evt.sourceEvent.code;
            this.inputMap[code] = false;
        }));

        scene.onBeforeRenderObservable.add(() => {
            this.updateFromKeyboard();
        });

        // clear en fin de frame pour laisser le gameplay consommer justPressed.
        scene.onAfterRenderObservable.add(() => {
            this.clearFrameInput();
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
    }

    clearFrameInput() {
        this.justPressed = {};
    }

}