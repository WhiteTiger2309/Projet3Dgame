let canvas;
let engine;
let scene;

window.onload = startGame;

function startGame() {
  canvas = document.querySelector("#myCanvas");
  engine = new BABYLON.Engine(canvas, true);

  scene = createScene();
  modifySettings();

  engine.runRenderLoop(() => {
    scene.render();
  });
}

function createScene() {
  const scene = new BABYLON.Scene(engine);

  // Collisions + gravité (comme tp1_exemple3/4)
  scene.collisionsEnabled = true;
  scene.gravity = new BABYLON.Vector3(0, -0.5, 0);

  // Un petit boost d'ambiance pour ne pas être trop sombre
  scene.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.3);

  // Un peu d'atmosphère, sans aller au-delà du prototype
  scene.clearColor = new BABYLON.Color4(0.02, 0.04, 0.06, 1);

  const camera = createFpsCamera(scene);
  createLights(scene);
  createGround(scene);
  createSimpleRuins(scene);

  return scene;
}

function createFpsCamera(scene) {
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

function createLights(scene) {
  const hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  hemi.intensity = 0.75;

  const dir = new BABYLON.DirectionalLight(
    "dir0",
    new BABYLON.Vector3(-0.5, -1, 0.2),
    scene
  );
  dir.intensity = 1.25;
  dir.position = new BABYLON.Vector3(50, 80, -30);
}

function createGround(scene) {
  const ground = BABYLON.MeshBuilder.CreateGround(
    "ground",
    { width: 250, height: 250, subdivisions: 2 },
    scene
  );

  const mat = new BABYLON.StandardMaterial("groundMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
  mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  ground.material = mat;

  ground.checkCollisions = true;
  return ground;
}

function createSimpleRuins(scene) {
  // Quelques obstacles simples pour tester collisions + navigation
  const ruinMat = new BABYLON.StandardMaterial("ruinMat", scene);
  ruinMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.22);
  ruinMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.06);

  const makeBlock = (name, size, position) => {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { size }, scene);
    mesh.position = position.clone();
    mesh.material = ruinMat;
    mesh.checkCollisions = true;
    return mesh;
  };

  // "Vaisseau" très simplifié (repère de spawn)
  const ship = BABYLON.MeshBuilder.CreateBox(
    "ship",
    { width: 6, height: 2, depth: 10 },
    scene
  );
  ship.position = new BABYLON.Vector3(0, 1, -18);
  ship.material = ruinMat;
  ship.checkCollisions = true;

  // Arche / pylônes simplifiés
  makeBlock("pillar1", 3, new BABYLON.Vector3(12, 1.5, 8));
  makeBlock("pillar2", 3, new BABYLON.Vector3(18, 1.5, 8));

  const lintel = BABYLON.MeshBuilder.CreateBox(
    "lintel",
    { width: 10, height: 1.5, depth: 2 },
    scene
  );
  lintel.position = new BABYLON.Vector3(15, 4, 8);
  lintel.material = ruinMat;
  lintel.checkCollisions = true;

  // Quelques rochers
  const rockMat = new BABYLON.StandardMaterial("rockMat", scene);
  rockMat.diffuseColor = new BABYLON.Color3(0.10, 0.10, 0.11);

  const rocks = [
    new BABYLON.Vector3(-8, 1, 6),
    new BABYLON.Vector3(-14, 1, 14),
    new BABYLON.Vector3(6, 1, 18),
  ];

  rocks.forEach((p, i) => {
    const rock = BABYLON.MeshBuilder.CreateSphere(
      `rock_${i}`,
      { diameter: 3 + i * 0.8, segments: 8 },
      scene
    );
    rock.position = p.clone();
    rock.scaling.y = 0.6;
    rock.material = rockMat;
    rock.checkCollisions = true;
  });
}

function modifySettings() {
  // Pointer lock (comme tp1_exemple4) : click dans le canvas => souris verrouillée
  scene.onPointerDown = () => {
    if (!scene.alreadyLocked) {
      canvas.requestPointerLock();
    }
  };

  document.addEventListener("pointerlockchange", () => {
    const element = document.pointerLockElement || null;
    scene.alreadyLocked = !!element;
  });
}

window.addEventListener("resize", () => {
  engine.resize();
});
