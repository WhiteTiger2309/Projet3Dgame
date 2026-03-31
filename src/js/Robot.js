import * as BABYLON from '@babylonjs/core'
import { addStaticPhysics } from './utils/utils.js';


export class Robot {
    constructor(main, pos, rotation) {
        this.scene = main.scene
        this.main = main
        this.pos = pos
        this.rotation = rotation
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
                mesh.metadata.aggregate = addStaticPhysics(mesh, "BOX")
                mesh.metadata.hasDialog = true
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
}