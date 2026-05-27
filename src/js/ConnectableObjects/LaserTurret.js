import * as BABYLON from '@babylonjs/core'

import { addStaticPhysics, createMeshFromAsset, placeOnMesh } from '../utils/utils.js';
import { createEmissiveStripTexture } from '../utils/materials.js';
import { Destination } from './Destination.js';

export class LaserTurret extends Destination {
    constructor(main, position, rotation, canBeRewired, options = {}) {
        super(main, position, rotation, canBeRewired)

        this.yaw = BABYLON.Tools.ToRadians(rotation ?? 0)
        this.pitch = BABYLON.Tools.ToRadians(options.pitch ?? 0)
        this.maxDistance = options.maxDistance ?? 45
        this.color = options.color ?? new BABYLON.Color3(1.0, 0.2, 0.2)
        this.enabled = options.enabled ?? false
        this.controlActive = false
        this.yawSpeed = options.yawSpeed ?? 1.1
        this.pitchSpeed = options.pitchSpeed ?? 0.8
        this._now = 0
        this._laserBeamPool = []
        this._laserBeamMats = new Map()
        this._keyPrev = {}
        this._keyJustPressed = {}

        this.ensureLaserBeamShaders()

        this.defaultPos = placeOnMesh(main, position.clone())
        this.mesh = this.createMesh(this.defaultPos)

        this.applyVisualState()
    }

    createMesh(pos) {
        const base = BABYLON.MeshBuilder.CreateCylinder('laserTurretBase', {
            diameter: 1.1,
            height: 1.4,
            tessellation: 16,
        }, this.main.scene)

        base.position = pos.clone()
        base.position.y += 0.7

        const emissiveTex = createEmissiveStripTexture(this.main.scene, 'laserTurretBase_emissive_dt', {
            size: 512,
            style: 'outline',
            outlineWidthPx: 2,
            outlineGlowPx: 8,
            color: this.color,
            intensity: 1.1,
        })

        const mat = new BABYLON.StandardMaterial('laserTurretBaseMat', this.main.scene)
        mat.diffuseColor = new BABYLON.Color3(0.22, 0.22, 0.24)
        mat.emissiveColor = this.color.scale(0.45)
        mat.emissiveTexture = emissiveTex
        mat.specularColor = BABYLON.Color3.Black()
        base.material = mat

        const aggregate = addStaticPhysics(base, 'BOX')
        aggregate.body.disablePreStep = false

        base.metadata = {
            ...(base.metadata || {}),
            connectable: this,
            laserBlocker: true,
            aggregate,
        }

        this.baseMaterial = mat
        this.baseEmissive = mat.emissiveColor.clone()

        this.turretRoot = null
        this.turretHalo = null
        if (this.main.assets?.turret) {
            const turretPos = pos.clone()
            turretPos.y += -0.2

            const turret = createMeshFromAsset(
                this.main.assets['turret'],
                turretPos,
                'MESH',
                BABYLON.Tools.ToRadians(90),
                false
            )

            turret.scaling = new BABYLON.Vector3(0.8, 0.8, 0.8)
            turret.rotationQuaternion = null
            turret.rotation.y = this.yaw

            let proxyAssigned = false
            let highlightTarget = null
            turret.getDescendants().forEach((m) => {
                try {
                    m.isVisible = true
                    m.metadata = m.metadata || {}
                    m.metadata.laserBlocker = false
                    m.metadata.laserReflector = false

                    if (!proxyAssigned && m.getBoundingInfo) {
                        m.isPickable = true
                        m.metadata.connectable = this
                        m.metadata.isInteractable = true
                        m.metadata.onInteract = () => this.toggleControl()
                        highlightTarget = m
                        proxyAssigned = true
                    }
                    else {
                        m.isPickable = false
                    }
                } catch {
                    // noop
                }
            })

            if (!proxyAssigned) {
                turret.isPickable = true
                turret.metadata = turret.metadata || {}
                turret.metadata.connectable = this
                turret.metadata.isInteractable = true
                turret.metadata.onInteract = () => this.toggleControl()
                highlightTarget = turret
            }

            turret.isPickable = true
            turret.metadata = turret.metadata || {}
            turret.metadata.connectable = this
            turret.metadata.isInteractable = true
            turret.metadata.onInteract = () => this.toggleControl()

            this.highlightMesh = highlightTarget ?? turret

            try {
                const haloMat = new BABYLON.StandardMaterial('laserTurretHaloMat', this.main.scene)
                haloMat.emissiveColor = new BABYLON.Color3(0.12, 0.95, 0.8)
                haloMat.alpha = 0.9

                const halo = BABYLON.MeshBuilder.CreateTorus('laserTurretHalo', {
                    diameter: 1.6,
                    thickness: 0.08,
                    tessellation: 32,
                }, this.main.scene)
                halo.parent = turret
                halo.position = new BABYLON.Vector3(0, 0.18, 0)
                halo.rotation.x = Math.PI / 2
                halo.material = haloMat
                halo.isPickable = false

                this.turretHalo = halo
            } catch {
                // noop
            }

            base.isVisible = false
            base.getChildren().forEach((c) => {
                c.isVisible = false
            })

            this.turretRoot = turret
        }

        this._laserBeamPool.push(this.createLaserBeamCross(this.main.scene, 'laserTurretBeam', null, { width: 0.065 }))

        return base
    }

    ensureLaserBeamShaders() {
        if (BABYLON.Effect.ShadersStore['laserBeamVertexShader'] && BABYLON.Effect.ShadersStore['laserBeamFragmentShader']) {
            return;
        }

        BABYLON.Effect.ShadersStore['laserBeamVertexShader'] = `
            precision highp float;
            attribute vec3 position;
            attribute vec2 uv;

            uniform mat4 worldViewProjection;

            varying vec2 vUV;

            void main(void) {
                vUV = uv;
                gl_Position = worldViewProjection * vec4(position, 1.0);
            }
        `;

        BABYLON.Effect.ShadersStore['laserBeamFragmentShader'] = `
            precision highp float;

            varying vec2 vUV;

            uniform float time;
            uniform float beamLength;
            uniform float intensity;
            uniform vec3 beamColor;

            void main(void) {
                float x = abs(vUV.x - 0.5) * 2.0;
                float core = smoothstep(1.0, 0.0, x);
                core = pow(core, 3.0);

                float worldFreq = max(0.5, beamLength * 0.6);
                float t = vUV.y * worldFreq - time * 6.5;
                float pulse = 0.55 + 0.45 * sin(t * 6.2831853);

                float alpha = core * (0.65 + 0.35 * pulse);
                alpha *= intensity;

                vec3 col = beamColor * alpha;
                gl_FragColor = vec4(col, alpha);
            }
        `;
    }

    createLaserBeamCross(scene, name, material, { width = 0.06 } = {}) {
        const root = new BABYLON.TransformNode(name + '_root', scene);
        root.rotationQuaternion = BABYLON.Quaternion.Identity();

        const p1 = BABYLON.MeshBuilder.CreatePlane(name + '_p1', {
            width: 1,
            height: 1,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        }, scene);
        p1.isPickable = false;
        p1.parent = root;
        p1.material = material;
        p1.scaling.x = width;

        const p2 = p1.clone(name + '_p2');
        p2.isPickable = false;
        p2.parent = root;
        p2.rotation.y = Math.PI / 2;
        p2.scaling.x = width;

        root.setEnabled(false);

        return { root, p1, p2 };
    }

    setLaserBeamSegment(beam, material, start, end) {
        const delta = end.subtract(start);
        const length = delta.length();
        if (!isFinite(length) || length < 0.05) {
            beam.root.setEnabled(false);
            return;
        }

        const dir = delta.scale(1 / length);
        const mid = start.add(delta.scale(0.5));

        beam.root.setEnabled(true);
        beam.root.position.copyFrom(mid);
        beam.root.rotationQuaternion = this.quaternionFromUpToDir(dir);
        beam.p1.scaling.y = length;
        beam.p2.scaling.y = length;
    }

    quaternionFromUpToDir(dir) {
        const from = BABYLON.Vector3.Up();
        const to = dir.normalize();
        const dot = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(from, to), -1, 1);

        if (dot > 0.999999) {
            return BABYLON.Quaternion.Identity();
        }
        if (dot < -0.999999) {
            return BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI);
        }

        const axis = BABYLON.Vector3.Cross(from, to);
        axis.normalize();
        const angle = Math.acos(dot);
        return BABYLON.Quaternion.RotationAxis(axis, angle);
    }

    activate() {
        this.enabled = true
        this.applyVisualState()
    }

    deactivate() {
        this.enabled = false
        this.applyVisualState()
    }

    applyVisualState() {
        if (this.baseMaterial) {
            this.baseMaterial.emissiveColor = this.enabled
                ? this.color.scale(2.0)
                : this.baseEmissive.clone()
        }

        if (this.turretHalo?.material) {
            try {
                this.turretHalo.material.emissiveColor = this.enabled
                    ? new BABYLON.Color3(2.2, 1.1, 0.35)
                    : new BABYLON.Color3(0.08, 0.12, 0.10)
                this.turretHalo.setEnabled(true)
            } catch {
                // noop
            }
        }

        if (!this.enabled && this.beam) {
            this._laserBeamPool.forEach((beam) => beam.root.setEnabled(false))
        }
    }

    getDirectionFromYawPitch() {
        const cp = Math.cos(this.pitch)
        return new BABYLON.Vector3(
            cp * Math.cos(this.yaw),
            Math.sin(this.pitch),
            cp * Math.sin(this.yaw)
        ).normalize()
    }

    toggleControl() {
        this.controlActive = !this.controlActive
        this.applyVisualState()
    }

    updateKeyEdges() {
        const inputMap = this.main?.player?.input?.inputMap || {}
        const prev = this._keyPrev || (this._keyPrev = {})
        const just = {}

        for (const k of ['KeyT', 'Escape']) {
            const cur = !!inputMap[k]
            const was = !!prev[k]
            if (cur && !was) just[k] = true
            prev[k] = cur
        }

        this._keyJustPressed = just
    }

    updateControls(deltaTime = 0) {
        if (this._keyJustPressed?.KeyT || this._keyJustPressed?.Escape) {
            this.controlActive = false
            this.applyVisualState()
        }

        if (!this.controlActive) return

        const inputMap = this.main?.player?.input?.inputMap || {}
        const dt = deltaTime || this.main?.deltaTime || 0

        const keyDown = (...codes) => codes.some((c) => !!inputMap[c])

        let yawDelta = 0
        let pitchDelta = 0

        if (keyDown('KeyJ', 'ArrowLeft', 'Numpad4')) yawDelta += this.yawSpeed * dt
        if (keyDown('KeyL', 'ArrowRight', 'Numpad6')) yawDelta -= this.yawSpeed * dt
        if (keyDown('KeyI', 'ArrowUp', 'Numpad8')) pitchDelta += this.pitchSpeed * dt
        if (keyDown('KeyK', 'ArrowDown', 'Numpad5')) pitchDelta -= this.pitchSpeed * dt

        this.yaw += yawDelta
        this.pitch = BABYLON.Scalar.Clamp(this.pitch + pitchDelta, -1.0, 1.0)
    }

    update(deltaTime = 0) {
        this.updateKeyEdges()
        this.updateControls(deltaTime)
        this.lastHitSensorId = null
        this.lastHitMesh = null

        if (!this.enabled || !this.mesh || !this._laserBeamPool.length) {
            this._laserBeamPool.forEach((beam) => beam.root.setEnabled(false))
            return
        }

        this._now = (this._now || 0) + deltaTime

        const scene = this.main.scene
        const dir = this.getDirectionFromYawPitch()
        const start = this.mesh.getAbsolutePosition().add(dir.scale(0.9)).add(new BABYLON.Vector3(0, 0.9, 0))

        const ray = new BABYLON.Ray(start, dir, this.maxDistance)
        const hit = scene.pickWithRay(ray, (mesh) => {
            if (!mesh || mesh === this.mesh) return false
            if (this.turretRoot && mesh === this.turretRoot) return false
            const md = mesh.metadata
            return !!md?.laserBlocker || !!md?.laserReflector || !!md?.laserSensorId || !!mesh.physicsBody
        })

        if (hit?.hit && hit.pickedMesh) {
            this.lastHitMesh = hit.pickedMesh
            const md = hit.pickedMesh.metadata || {}
            if (md.laserSensorId) {
                this.lastHitSensorId = md.laserSensorId
            }
        }

        const end = hit?.hit ? hit.pickedPoint : start.add(dir.scale(this.maxDistance))

        const beam = this._laserBeamPool[0]
        let mat = this._laserBeamMats.get('default')
        if (!mat) {
            mat = new BABYLON.ShaderMaterial(
                'laserTurretBeamMat',
                scene,
                { vertex: 'laserBeam', fragment: 'laserBeam' },
                {
                    attributes: ['position', 'uv'],
                    uniforms: ['worldViewProjection', 'time', 'beamLength', 'intensity', 'beamColor'],
                }
            )
            mat.backFaceCulling = false
            mat.alphaMode = BABYLON.Engine.ALPHA_ADD
            mat.disableDepthWrite = true
            mat.setColor3('beamColor', this.color)
            this._laserBeamMats.set('default', mat)
        }

        mat.setFloat('time', this._now)
        mat.setFloat('beamLength', BABYLON.Vector3.Distance(start, end))
        mat.setFloat('intensity', 1.0)
        beam.p1.material = mat
        beam.p2.material = mat
        this.setLaserBeamSegment(beam, mat, start, end)

        if (this.turretRoot) {
            try {
                const target = this.turretRoot.position.add(dir)
                this.turretRoot.lookAt(target)
            } catch {
                // noop
            }
        }
    }
}
