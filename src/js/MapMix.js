import * as BABYLON from '@babylonjs/core'

import { DefautlMapPuzzle } from './DefautlMapPuzzle.js';
import { addStaticPhysics, createMapChangeGate, createDiegeticTeleportMarker, placeOnGround, createMeshFromAsset, createBounceSlime, createBox } from './utils/utils.js';
import { createEmissiveStripTexture } from './utils/materials.js';
import { Robot } from './Robot.js';
import { PressurePlate } from './ConnectableObjects/PressurePlate.js';
import { Door } from './ConnectableObjects/Door.js';
import { Button } from './ConnectableObjects/Button.js';
import { LaserTurret } from './ConnectableObjects/LaserTurret.js';
import { MapFin } from './MapFin.js';


export class MapMix extends DefautlMapPuzzle {
    constructor(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION) {
        super(main, PLAYER_SPAWN_POS, PLAYER_SPAWN_ROTATION)
        this.player.playerData.hasLinkPower = true
    }

    createPuzzle() {
        this.robot = new Robot(this.main, new BABYLON.Vector3(4.9, 1.2, 3.0), 90, "DialogMix")
        this.exitDoor = new Door(this.main, new BABYLON.Vector3(-0.1, 0, -12.8), 0, false, "y", 3)
        this.laserTurret = new LaserTurret(this.main, new BABYLON.Vector3(-4.2, 0, 4), 0, true, {
            enabled: false,
            maxDistance: 45
        })
        this.pressurePlate = new PressurePlate(this.main, new BABYLON.Vector3(2.3, 1.1, -0.8), 0, true, this.laserTurret)
        this.laserSensorId = 'mix_sensor_1'
        this._laserSensorWasActive = false
        this.createLaserSensor(new BABYLON.Vector3(3.8, 2.2, 4.0))
        createBox(this.main, new BABYLON.Vector3(-3.9, 1.2, -1.2), 1)
        this.gate.metadata.map = MapFin;
        const gatePos = new BABYLON.Vector3(-0.1, 0, -14);
        createMapChangeGate(this.main, MapFin, gatePos, undefined, 90);
        
        createDiegeticTeleportMarker(this.scene, gatePos, 'mix');
        
    }

    createLaserSensor(position) {
        const sensor = BABYLON.MeshBuilder.CreateCylinder('mixLaserSensor', {
            diameter: 1.6,
            height: 0.5,
            tessellation: 16,
        }, this.scene)
        sensor.position = new BABYLON.Vector3(8, 6, 8)
        sensor.rotation.x = Math.PI / 2
        sensor.isPickable = false

        const emissiveTex = createEmissiveStripTexture(this.scene, 'mixLaserSensor_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: new BABYLON.Color3(0.9, 0.35, 0.12),
            intensity: 1.0,
        })

        const mat = new BABYLON.StandardMaterial('mixLaserSensorMat', this.scene)
        mat.diffuseColor = new BABYLON.Color3(0.14, 0.16, 0.20)
        mat.emissiveColor = new BABYLON.Color3(0.9, 0.35, 0.12).scale(0.35)
        mat.emissiveTexture = emissiveTex
        mat.specularColor = BABYLON.Color3.Black()
        sensor.material = mat

        sensor.metadata = {
            ...(sensor.metadata || {}),
            laserBlocker: true,
            laserSensorId: this.laserSensorId,
        }

        addStaticPhysics(sensor, 'BOX')

        this.laserSensor = sensor
        this.laserSensorMat = mat
    }

    mapBeforeRenderUpdate() {
        if (this.laserTurret) {
            this.laserTurret.update(this.deltaTime)
        }

        const active = this.laserTurret?.lastHitSensorId === this.laserSensorId

        if (this.laserSensorMat) {
            this.laserSensorMat.emissiveColor = active
                ? new BABYLON.Color3(0.12, 0.95, 0.22).scale(2.0)
                : new BABYLON.Color3(0.9, 0.35, 0.12).scale(0.35)
        }

        if (active !== this._laserSensorWasActive) {
            this._laserSensorWasActive = active

            if (active) {
                this.exitDoor.activate()
                const sensorHitSound = this.main?.sounds?.sensorHit
                if (sensorHitSound) {
                    try {
                        if (sensorHitSound.isPlaying) {
                            sensorHitSound.stop()
                        }
                        sensorHitSound.play()
                    } catch {
                        // noop
                    }
                }
            } else {
                this.exitDoor.deactivate()
            }
        }
    }

}