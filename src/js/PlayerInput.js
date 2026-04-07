import * as BABYLON from '@babylonjs/core'

export class PlayerInput {

    constructor(scene) {
        scene.actionManager = new BABYLON.ActionManager(scene);

        this.inputMap = {};
        this.justPressed = {};

        this.keyBind = {
            "KeyW": "forward",
            "KeyS": "backward",
            "KeyA": "left",
            "KeyD": "right",
            "Space": "jump",
            "KeyE": "interact",
            "KeyP": "debug"
        };

        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
            let code = evt.sourceEvent.code;
            if (code in this.keyBind) {
                code = this.keyBind[code]
            }
            if (!this.inputMap[code]) {
                this.justPressed[code] = true;
            }
            this.inputMap[code] = true;
        }));
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
            let code = evt.sourceEvent.code;
            if (code in this.keyBind) {
                code = this.keyBind[code]
            }
            this.inputMap[code] = false;
        }));

        scene.onPointerObservable.add((pointerInfo) => {
            let code = "";

            if (pointerInfo.event.button === 0) code = "mouseLeft";
            if (pointerInfo.event.button === 1) code = "mouseMiddle";
            if (pointerInfo.event.button === 2) code = "mouseRight";

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                if (!this.inputMap[code]) {
                    this.justPressed[code] = true;
                }
                this.inputMap[code] = true;
            }

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                this.inputMap[code] = false;
            }
        });
    }

    update() {
        this.updateFromKeyboard();
        this.clearFrameInput();
    }

    updateFromKeyboard() {
        if (this.inputMap["forward"]) {
            this.vertical = BABYLON.Scalar.Lerp(this.vertical, 1, 0.2);
            this.verticalAxis = 1;

        } else if (this.inputMap["backward"]) {
            this.vertical = BABYLON.Scalar.Lerp(this.vertical, -1, 0.2);
            this.verticalAxis = -1;
        } else {
            this.vertical = 0;
            this.verticalAxis = 0;
        }

        if (this.inputMap["left"]) {
            this.horizontal = BABYLON.Scalar.Lerp(this.horizontal, -1, 0.2);
            this.horizontalAxis = -1;

        } else if (this.inputMap["right"]) {
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