// ─── INITIAL ENVIRONMENT ENGINE SETUP ────────────────────────────────────────
const viewport = document.getElementById('canvas-viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b13);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(11, 4, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera clipping through ground mesh

// ─── ENVIRONMENTAL ILLUMINATION LIGHTING MATRICES ────────────────────────────
const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
scene.add(ambientLight);

const systemLight = new THREE.DirectionalLight(0x0ea5e9, 2.2);
systemLight.position.set(8, 16, 8);
scene.add(systemLight);

// High-tech matrix layout grid floor
const coordinateGrid = new THREE.GridHelper(40, 40, 0x1e293b, 0x0f172a);
coordinateGrid.position.y = -0.5;
scene.add(coordinateGrid);

// ─── CORE MODEL DATA REGISTRY & GEOMETRIC ASSEMBLIES ─────────────────────────
const physicalTrainGroup = new THREE.Group();
const componentMeshes = {}; 

const componentHexCodes = {
  NOMINAL: 0x10b981,
  WARNING: 0xf59e0b,
  CRITICAL: 0xf43f5e
};

function generateMaterial(hexColor, transparentMode = false) {
  return new THREE.MeshStandardMaterial({
    color: hexColor,
    roughness: 0.25,
    metalness: 0.75,
    transparent: transparentMode,
    opacity: transparentMode ? 0.6 : 1.0,
    emissive: hexColor,
    emissiveIntensity: 0.12
  });
}

// Build Engine Car Structural Bed Frame
const structuralBed = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 2.2), generateMaterial(0x334155));
structuralBed.position.y = 0.5;
physicalTrainGroup.add(structuralBed);

// 1. TRANSMISSION GEARS COMPONENT
const gearGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.8, 14);
const gearMat = generateMaterial(componentHexCodes.NOMINAL);
gearMat.wireframe = true; // Digital hologram topology aesthetic
componentMeshes.gears = new THREE.Mesh(gearGeometry, gearMat);
componentMeshes.gears.position.set(-0.7, 1.1, 0);
componentMeshes.gears.rotation.z = Math.PI / 2;
physicalTrainGroup.add(componentMeshes.gears);

// 2. LUBRICATION FLUID SYSTEM MODULE (Tank)
const oilGeometry = new THREE.BoxGeometry(1.3, 0.9, 1.6);
componentMeshes.oil = new THREE.Mesh(oilGeometry, generateMaterial(componentHexCodes.NOMINAL, true));
componentMeshes.oil.position.set(1.1, 1.1, 0);
physicalTrainGroup.add(componentMeshes.oil);

// 3. STEEL WHEEL TRACTION BOGIE UNITS
const tractionWheelShape = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 28);
componentMeshes.wheels = [];
const wheelCoordinates = [
  {x: -1.9, z: 1.15}, {x: -1.9, z: -1.15},
  {x: 1.9, z: 1.15},  {x: 1.9, z: -1.15}
];

wheelCoordinates.forEach(coords => {
  const wheelMesh = new THREE.Mesh(tractionWheelShape, generateMaterial(componentHexCodes.NOMINAL));
  wheelMesh.rotation.x = Math.PI / 2;
  wheelMesh.position.set(coords.x, 0.38, coords.z);
  physicalTrainGroup.add(wheelMesh);
  componentMeshes.wheels.push(wheelMesh);
});

scene.add(physicalTrainGroup);

// Dynamic Animation Speed Matrices
let deltaVelocityGears = 0.015;
let deltaVelocityWheels = 0.03;

// ─── SOCKET.IO CENTRAL TELEMETRY STREAM PACKET SYNCHRONIZATION ──────────────
const ioStreamClient = io();

ioStreamClient.on('telemetry_update', (packet) => {
  if (!packet || !packet.components) return;
  
  // Flash Header System Sync Timestamps
  document.getElementById('live-timestamp').innerText = `Last Telemetry Cycle: ${packet.timestamp}`;
  document.getElementById('node-sync-id').innerText = `Sync Node Link: ${packet.train_id}`;

  const structures = packet.components;

  // Sync Node 1: Mechanical Transmission Gears
  document.getElementById('val-gears-temp').innerText = structures.gears.temperature;
  document.getElementById('val-gears-vibe').innerText = structures.gears.vibration;
  syncUINodeDisplay('gears', structures.gears.status);
  alterMeshColorMatrix(componentMeshes.gears, structures.gears.status);
  deltaVelocityGears = structures.gears.status === "NOMINAL" ? 0.02 : 0.07;

  // Sync Node 2: Fluid Lubrication Reserve
  document.getElementById('val-oil-level').innerText = `${structures.oil.level}%`;
  document.getElementById('bar-oil-level').style.width = `${structures.oil.level}%`;
  syncUINodeDisplay('oil', structures.oil.status);
  alterMeshColorMatrix(componentMeshes.oil, structures.oil.status);

  // Sync Node 3: Mechanical Wheel Units
  document.getElementById('val-wheels-rpm').innerText = structures.wheels.rpm;
  document.getElementById('val-wheels-wear').innerText = structures.wheels.wear_index;
  syncUINodeDisplay('wheels', structures.wheels.status);
  componentMeshes.wheels.forEach(meshInstance => alterMeshColorMatrix(meshInstance, structures.wheels.status));
  deltaVelocityWheels = (structures.wheels.rpm / 60) * 0.04;

  // Aggregate Master Global Header Status Check
  evaluateMasterSystemHealth(structures.gears.status, structures.oil.status, structures.wheels.status);
});

function alterMeshColorMatrix(targetMesh, status) {
  const colorTargetHex = componentHexCodes[status] || componentHexCodes.NOMINAL;
  targetMesh.material.color.setHex(colorTargetHex);
  if(targetMesh.material.emissive) targetMesh.material.emissive.setHex(colorTargetHex);
}

function syncUINodeDisplay(idKey, status) {
  const targetCard = document.getElementById(`card-${idKey}`);
  const targetBadge = document.getElementById(`badge-${idKey}`);
  if(!targetCard || !targetBadge) return;

  targetBadge.innerText = status;
  
  // Clean prior string variants
  targetCard.className = "metric-card";
  targetBadge.className = "status-lbl";

  if (status === "CRITICAL") {
    targetCard.classList.add('card-critical');
    targetBadge.classList.add('lbl-critical');
  } else if (status === "WARNING") {
    targetCard.classList.add('card-warning');
    targetBadge.classList.add('lbl-warning');
  } else {
    targetBadge.classList.add('lbl-nominal');
  }
}

function evaluateMasterSystemHealth(g, o, w) {
  const masterBadge = document.getElementById('global-status-badge');
  if(g === "CRITICAL" || o === "CRITICAL" || w === "CRITICAL") {
    masterBadge.innerText = "🚨 REPAIR OVERRIDE CRITICAL";
    masterBadge.className = "badge badge-critical";
  } else if (g === "WARNING" || o === "WARNING" || w === "WARNING") {
    masterBadge.innerText = "⚠️ ATTENTION REQUIRED";
    masterBadge.className = "badge badge-warning";
  } else {
    masterBadge.innerText = "✔ ALL SYSTEMS FUNCTIONAL";
    masterBadge.className = "badge badge-nominal";
  }
}

// ─── INTERACTIVE RAYCASTING COMPONENT HIT SELECTION MOUSE DETECTOR ───────────
const raycaster = new THREE.Raycaster();
const normalizedMouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  // Capture click geometry correctly bounded inside WebGL area dimensions
  normalizedMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  normalizedMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(normalizedMouse, camera);
  const targetSelectionIntersects = [componentMeshes.gears, componentMeshes.oil, ...componentMeshes.wheels];
  const interactions = raycaster.intersectObjects(targetSelectionIntersects);

  const displayPanel = document.getElementById('inspector-output');
  
  if (interactions.length > 0) {
    const contextNode = interactions[0].object;
    
    if (contextNode === componentMeshes.gears) {
      displayPanel.innerHTML = `<div class="inspector-details"><h4>⚙️ Epicyclic Gear Array</h4><p class="inspector-desc">Monitors planetary gear alignment profiles, structural teeth surface spalling, and rotational friction coefficients via acoustic emissions.</p></div>`;
    } else if (contextNode === componentMeshes.oil) {
      displayPanel.innerHTML = `<div class="inspector-details"><h4>🛢️ Fluid Fluid Hydrokinetics</h4><p class="inspector-desc">Tracks internal synthetic lubricant engine sump volume levels, oil viscosity deterioration indexes, and thermal conductivity shifts.</p></div>`;
    } else {
      displayPanel.innerHTML = `<div class="inspector-details"><h4>🎡 Steel Wheel Traction Hub</h4><p class="inspector-desc">Measures dynamic flange profile structural track wear metrics, high-frequency axle bearing temperature fluctuations, and rotational velocity speed RPM.</p></div>`;
    }
  }
});

// ─── CONTINUOUS RENDERING AND GRAPHICAL ANIMATION TIMELINES ──────────────────
function executeRenderFrame() {
  requestAnimationFrame(executeRenderFrame);

  // Dynamic mesh movement driven by live values
  componentMeshes.wheels.forEach(wheelMesh => wheelMesh.rotation.y += deltaVelocityWheels);
  if(componentMeshes.gears) componentMeshes.gears.rotation.y += deltaVelocityGears;

  // Procedural macro hovering idle bounce effect
  physicalTrainGroup.position.y = Math.sin(Date.now() * 0.002) * 0.04;

  controls.update();
  renderer.render(scene, camera);
}

// Handle Window Mutations dynamically
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

executeRenderFrame();



















































































































