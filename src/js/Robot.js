import * as BABYLON from '@babylonjs/core'
import { addStaticPhysics, placeOnMesh } from './utils/utils.js';


export class Robot {
    constructor(main, pos, rotation, dialogName = "Dialog1") {
        this.scene = main.scene
        this.main = main
        this.pos = placeOnMesh(main, pos)
        this.rotation = BABYLON.Tools.ToRadians(rotation)
        this.dialogName = dialogName
        this.root

        this.importRobot()
    }

    importRobot() {
        const instances = this.main.assets["robot"].instantiateModelsToScene((name) => name);
        this.root = instances.rootNodes[0];
        this.root.position = this.pos
        this.root.rotationQuaternion = null
        this.root.rotation.y = this.rotation
        this.root.getDescendants().forEach(mesh => {
            if (mesh.name == "RobotHitBox") {
                this.hitBoxMesh = mesh
                mesh.metadata.aggregate = addStaticPhysics(mesh, "BOX")
                mesh.metadata.aggregate.body.disablePreStep = false;
                mesh.metadata.hasDialog = true
                mesh.metadata.dialogName = this.dialogName
                mesh.metadata.onEnter = () => {
                    const RobotTalking = this.scene.getAnimationGroupByName("RobotFaceTalking")
                    RobotTalking.start(true)
                }
                mesh.metadata.onExit = () => {
                    const RobotTalking = this.scene.getAnimationGroupByName("RobotFaceTalking")
                    RobotTalking.stop()
                    const RobotIdle = this.scene.getAnimationGroupByName("RobotFaceIdle")
                    RobotIdle.start(true)
                }
            }
        });
        // const RobotFaceIdle = this.scene.getAnimationGroupByName("RobotFaceIdle")
        // RobotFaceIdle.stop()
        // // const RobotTalking = this.scene.getAnimationGroupByName("RobotFaceTalking")
        // // RobotTalking.start(true)
        // const RobotIdle = this.scene.getAnimationGroupByName("RobotIdle")
        // RobotIdle.start(true)
        // console.log(this.scene.animationGroups)

        // console.log(result)
        // result.transformNodes[5]._children[0]._rotationQuaternion.y = 0.5
        // console.log(result.transformNodes[5]._children[0])
    }

    activateDoor() {
        this.hitBoxMesh.metadata.hasDialog = false
        this.root.rotation.y = BABYLON.Tools.ToRadians(-90)
        BABYLON.Animation.CreateAndStartAnimation(
            "robotMove",
            this.root,
            `position.x`,
            60,
            180,
            this.root.position.x,
            10.5,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
            undefined,
            () => {
                this.root.rotation.y = BABYLON.Tools.ToRadians(180)
                move2()
            }
        );
        const move2 = () => {
            BABYLON.Animation.CreateAndStartAnimation(
                "robotMove",
                this.root,
                `position.z`,
                60,
                180,
                this.root.position.z,
                2,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
                undefined,
                () => {
                    this.root.rotation.y = BABYLON.Tools.ToRadians(-90)
                    this.main.player.connectionManager.connect(this.main.map.exitButton, this.main.map.exitDoor)
                    this.main.map.exitButton.activate()
                    this.hitBoxMesh.metadata.hasDialog = true
                }
            );
        }
    }

}