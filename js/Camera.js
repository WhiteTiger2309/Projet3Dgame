export function createFPSCamera(scene, canvas) {
    const camera = new BABYLON.FreeCamera(
        "fpsCamera",
        // Hauteur des yeux (environ 1m70)
        new BABYLON.Vector3(0, 1.7, -10),
        scene
    );

    camera.attachControl(canvas);

    camera.checkCollisions = true;
    camera.applyGravity = true;

    // Taille du "corps" pour les collisions (capsule simplifiée)
    camera.ellipsoid = new BABYLON.Vector3(0.5, 0.9, 0.5);
    camera.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);

    // Sensations FPS
    camera.speed = 0.6;
    camera.angularSensibility = 3000;
    camera.inertia = 0.7;
    camera.minZ = 0.1;

    // ZQSD (AZERTY) + majuscules (comme tp1_exemple4)
    camera.keysUp.push("z".charCodeAt(0), "Z".charCodeAt(0));
    camera.keysDown.push("s".charCodeAt(0), "S".charCodeAt(0));
    camera.keysLeft.push("q".charCodeAt(0), "Q".charCodeAt(0));
    camera.keysRight.push("d".charCodeAt(0), "D".charCodeAt(0));


    return camera;
}