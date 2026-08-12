import { AudioEngine } from "./src/audio-engine.js";
import { CardPool } from "./src/card-pool.js";
import { loadMessages } from "./src/feeds.js";
import { cycleDuration, phaseAt } from "./src/timeline.js";

const scene = document.querySelector("#xr-scene");
const rig = document.querySelector("#rig");
const cameraEl = document.querySelector("#viewer");
const leftController = document.querySelector("#left-controller");
const rightController = document.querySelector("#right-controller");
const leftPointer = document.querySelector("#left-pointer");
const rightPointer = document.querySelector("#right-pointer");
const cardsRoot = document.querySelector("#news-root");
const swarmRoot = document.querySelector("#data-swarm");
const vrHud = document.querySelector("#vr-hud");
const vrPhase = document.querySelector("#vr-phase");
const vrHelp = document.querySelector("#vr-help");
const vrPauseButton = document.querySelector("#vr-pause-button");
const vrPauseLabel = document.querySelector("#vr-pause-label");
const startScreen = document.querySelector("#start-screen");
const browserButton = document.querySelector("#browser-button");
const vrButton = document.querySelector("#vr-button");
const installButton = document.querySelector("#install-button");
const hud = document.querySelector("#hud");
const phaseLabel = document.querySelector("#phase-label");
const timer = document.querySelector("#timer");
const messageCount = document.querySelector("#message-count");
const feedStatus = document.querySelector("#feed-status");
const pauseAllButton = document.querySelector("#pause-all");
const desktopHelp = document.querySelector("#desktop-help");
const toastEl = document.querySelector("#toast");

const AFRAME = window.AFRAME;
const THREE = AFRAME.THREE;
const audio = new AudioEngine();
const state = {
  running: false,
  startedAt: 0,
  pauseStartedAt: 0,
  pausedDuration: 0,
  manualPaused: false,
  phaseIndex: -1,
  phase: null,
  lastSpawnAt: 0,
  lastSoundAt: 0,
  rssCount: 0,
  closedCount: 0,
  testOffset: 0,
};

let messages = [];
let cards;
let swarm;
let deferredInstall;
let toastTimer;
let initializationPromise;
let snapLatch = false;

const leftAxis = new THREE.Vector2();
const cameraPosition = new THREE.Vector3();
const oldCameraPosition = new THREE.Vector3();
const newCameraPosition = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const movement = new THREE.Vector3();
const listenerForward = new THREE.Vector3();
const listenerUp = new THREE.Vector3();
const cameraQuaternion = new THREE.Quaternion();
const soundPosition = new THREE.Vector3();

const params = new URLSearchParams(location.search);
const localTesting = location.hostname === "localhost" || location.hostname === "127.0.0.1";
if (localTesting && params.has("start")) state.testOffset = Number(params.get("start")) || 0;

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 1100);
}

function randomMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}

function playSpawnSound(slot) {
  const now = performance.now();
  if (now - state.lastSoundAt < 70) return;
  state.lastSoundAt = now;
  slot.entity.object3D.getWorldPosition(soundPosition);
  audio.plop(slot.pitch, soundPosition);
}

function spawnCard({ sound = true } = {}) {
  if (!cards || !messages.length || cards.size >= cards.max) return null;
  cameraEl.object3D.getWorldPosition(cameraPosition);
  const slot = cards.acquire(randomMessage(), cameraPosition);
  if (slot && sound) playSpawnSound(slot);
  updateMessageCount();
  return slot;
}

function toggleCard(slot) {
  const paused = cards.toggle(slot);
  slot.entity.object3D.getWorldPosition(soundPosition);
  audio.plop(paused ? 0.62 : 1.16, soundPosition);
  showToast(paused ? "NEWS ANGEHALTEN" : "NEWS FORTGESETZT");
  updateMessageCount();
}

function closeCard(slot) {
  slot.entity.object3D.getWorldPosition(soundPosition);
  audio.close(slot.pitch, soundPosition);
  const sizeBeforeClose = cards.size;
  cards.release(slot);
  cards.prepareReplacement(slot, Math.max(0, sizeBeforeClose + 1 - cards.max));
  state.closedCount += 1;
  const created = [spawnCard(), spawnCard()].filter(Boolean).length;
  scene.dataset.closedCount = String(state.closedCount);
  scene.dataset.lastCloseSpawned = String(created);
  showToast(`GESCHLOSSEN · ${created} NEUE NEWS`);
  updateMessageCount();
}

function updateMessageCount() {
  if (!cards) return;
  const paused = cards.pausedCount;
  messageCount.textContent = paused ? `${cards.size} NEWS · ${paused} ANGEHALTEN` : `${cards.size} NEWS`;
  scene.dataset.cardCount = String(cards.size);
  scene.dataset.pausedCards = String(paused);
}

function buildSwarm() {
  const pointCount = 650;
  const points = [];
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  for (let index = 0; index < pointCount; index += 1) {
    const radius = THREE.MathUtils.lerp(2, 12, Math.pow(Math.random(), 0.7));
    const theta = Math.random() * Math.PI * 2;
    const vertical = THREE.MathUtils.randFloatSpread(1.8);
    const planar = Math.sqrt(1 - vertical * vertical * 0.25);
    const point = new THREE.Vector3(
      Math.cos(theta) * planar * radius,
      1.4 + vertical * radius * 0.46,
      Math.sin(theta) * planar * radius,
    );
    points.push(point);
    positions.set([point.x, point.y, point.z], index * 3);
    colors.set([
      THREE.MathUtils.randFloat(0.08, 0.18),
      THREE.MathUtils.randFloat(0.3, 0.55),
      THREE.MathUtils.randFloat(0.68, 1),
    ], index * 3);
  }
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const pointMaterial = new THREE.PointsMaterial({
    size: 0.032,
    vertexColors: true,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pointMesh = new THREE.Points(pointGeometry, pointMaterial);
  const lineCount = 170;
  const linePositions = new Float32Array(lineCount * 6);
  for (let index = 0; index < lineCount; index += 1) {
    const first = points[Math.floor(Math.random() * points.length)];
    let second = points[Math.floor(Math.random() * points.length)];
    let attempts = 0;
    while (first.distanceTo(second) > 3.1 && attempts < 8) {
      second = points[Math.floor(Math.random() * points.length)];
      attempts += 1;
    }
    linePositions.set([first.x, first.y, first.z, second.x, second.y, second.z], index * 6);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x174681,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
  const group = new THREE.Group();
  group.add(pointMesh, lineMesh);
  swarmRoot.setObject3D("mesh", group);
  swarm = { group, pointMaterial, lineMaterial };
}

function effectiveElapsed(now) {
  const currentPause = state.manualPaused ? now - state.pauseStartedAt : 0;
  return (now - state.startedAt - state.pausedDuration - currentPause) / 1000 + state.testOffset;
}

async function enterPhase(index, phase) {
  state.phaseIndex = index;
  state.phase = phase;
  phaseLabel.textContent = phase.label;
  vrPhase.setAttribute("value", phase.label);
  scene.dataset.phase = phase.label;
  scene.dataset.phaseType = phase.type;
  state.lastSpawnAt = 0;
  cards.releaseAll();
  updateMessageCount();
  if (phase.type === "pause") {
    document.body.classList.add("is-silent");
    cardsRoot.object3D.visible = false;
    swarmRoot.object3D.visible = false;
    vrHud.setAttribute("visible", false);
    vrPauseButton.classList.remove("interactive");
    await audio.suspend();
    scene.dataset.audioState = audio.state;
    return;
  }
  document.body.classList.remove("is-silent");
  cardsRoot.object3D.visible = true;
  swarmRoot.object3D.visible = true;
  vrHud.setAttribute("visible", scene.is("vr-mode"));
  vrPauseButton.classList.toggle("interactive", scene.is("vr-mode"));
  for (let count = 0; count < phase.initial; count += 1) spawnCard({ sound: false });
  if (!state.manualPaused) await audio.resume();
  scene.dataset.audioState = audio.state;
}

function updatePhase(now) {
  const elapsed = effectiveElapsed(now);
  const current = phaseAt(elapsed);
  if (current.index !== state.phaseIndex) void enterPhase(current.index, current.phase);
  const cycleTime = ((elapsed % cycleDuration) + cycleDuration) % cycleDuration;
  const minutes = Math.floor(cycleTime / 60);
  const seconds = Math.floor(cycleTime % 60);
  timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return current;
}

function updateLocomotion(delta) {
  if (!scene.is("vr-mode") || state.phase?.type === "pause") return;
  const x = Math.abs(leftAxis.x) > 0.13 ? leftAxis.x : 0;
  const y = Math.abs(leftAxis.y) > 0.13 ? leftAxis.y : 0;
  if (!x && !y) return;
  cameraEl.object3D.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.set(-forward.z, 0, forward.x).normalize();
  movement.set(0, 0, 0);
  movement.addScaledVector(forward, -y);
  movement.addScaledVector(right, x);
  if (movement.lengthSq() > 1) movement.normalize();
  rig.object3D.position.addScaledVector(movement, delta * 1.35);
}

function snapTurn(direction) {
  if (!scene.is("vr-mode")) return;
  cameraEl.object3D.getWorldPosition(oldCameraPosition);
  rig.object3D.rotation.y += THREE.MathUtils.degToRad(direction * -30);
  rig.object3D.updateMatrixWorld(true);
  cameraEl.object3D.getWorldPosition(newCameraPosition);
  rig.object3D.position.add(oldCameraPosition.sub(newCameraPosition));
}

function updateAudioListener() {
  if (!audio.context) return;
  cameraEl.object3D.getWorldPosition(cameraPosition);
  cameraEl.object3D.getWorldQuaternion(cameraQuaternion);
  listenerForward.set(0, 0, -1).applyQuaternion(cameraQuaternion);
  listenerUp.set(0, 1, 0).applyQuaternion(cameraQuaternion);
  audio.updateListener(cameraPosition, listenerForward, listenerUp);
}

function updatePointer(controller, pointer) {
  const intersections = controller.components.raycaster?.intersections;
  const intersection = intersections?.[0];
  if (!scene.is("vr-mode") || !intersection) {
    pointer.object3D.visible = false;
    return;
  }
  pointer.object3D.visible = true;
  pointer.object3D.position.copy(intersection.point);
  pointer.object3D.lookAt(cameraPosition);
  pointer.object3D.translateZ(0.008);
}

function updatePointers() {
  if (state.phase?.type === "pause") {
    leftPointer.object3D.visible = false;
    rightPointer.object3D.visible = false;
    return;
  }
  cameraEl.object3D.getWorldPosition(cameraPosition);
  updatePointer(leftController, leftPointer);
  updatePointer(rightController, rightPointer);
}

function updateScene(delta, now, current) {
  if (current.phase.type === "pause") return;
  updateLocomotion(delta);
  updateAudioListener();
  if (state.manualPaused) return;
  const rate = THREE.MathUtils.lerp(current.phase.startRate, current.phase.endRate, current.progress);
  const target = Math.round(THREE.MathUtils.lerp(current.phase.initial, current.phase.target, Math.pow(current.progress, 0.64)));
  if (now - state.lastSpawnAt >= rate && cards.size < target) {
    state.lastSpawnAt = now;
    for (let count = 0; count < current.phase.batch && cards.size < target; count += 1) spawnCard();
  }
  cameraEl.object3D.getWorldPosition(cameraPosition);
  cards.update(delta, current.phase.intensity, now, cameraPosition);
  if (swarm) {
    swarm.group.rotation.y = now * 0.000017 * current.phase.intensity;
    swarm.group.rotation.x = Math.sin(now * 0.00008) * 0.026;
    swarm.pointMaterial.opacity = 0.54 + Math.sin(now * 0.0022) * 0.12;
    swarm.lineMaterial.opacity = 0.08 + current.phase.intensity * 0.026;
  }
}

async function toggleAll() {
  if (!state.running || state.phase?.type === "pause") return;
  const now = performance.now();
  state.manualPaused = !state.manualPaused;
  if (state.manualPaused) {
    state.pauseStartedAt = now;
    await audio.suspend();
  } else {
    state.pausedDuration += now - state.pauseStartedAt;
    state.pauseStartedAt = 0;
    await audio.resume();
    audio.plop(0.9, cameraPosition);
  }
  const label = state.manualPaused ? "ALLE FORTSETZEN" : "ALLE ANHALTEN";
  pauseAllButton.textContent = label;
  pauseAllButton.classList.toggle("is-paused", state.manualPaused);
  vrPauseLabel.setAttribute("value", label);
  vrPauseButton.setAttribute("material", "color", state.manualPaused ? "#98bfff" : "#0a1b35");
  vrPauseLabel.setAttribute("color", state.manualPaused ? "#07101f" : "#ffffff");
  scene.dataset.manualPaused = String(state.manualPaused);
  scene.dataset.audioState = audio.state;
  showToast(state.manualPaused ? "ALLE NEWS ANGEHALTEN" : "ALLE NEWS FORTGESETZT");
}

function onLeftAxis(event) {
  leftAxis.set(event.detail.x || 0, event.detail.y || 0);
}

function onRightAxis(event) {
  const x = event.detail.x || 0;
  if (Math.abs(x) > 0.72 && !snapLatch) {
    snapLatch = true;
    snapTurn(Math.sign(x));
  } else if (Math.abs(x) < 0.24) {
    snapLatch = false;
  }
}

async function startExperience({ enterVR = false } = {}) {
  await ensureInitialized();
  await audio.start();
  if (!state.running) {
    state.running = true;
    state.startedAt = performance.now();
    state.phaseIndex = -1;
    startScreen.classList.add("is-hidden");
    hud.classList.add("is-visible");
    pauseAllButton.classList.add("is-visible");
    desktopHelp.classList.add("is-visible");
  }
  if (enterVR && !scene.is("vr-mode")) {
    try {
      await scene.enterVR();
    } catch {
      showToast("VR-START WURDE ABGEBROCHEN");
    }
  }
}

async function initialize() {
  buildSwarm();
  const loaded = await loadMessages();
  messages = loaded.messages;
  state.rssCount = loaded.rssCount;
  feedStatus.textContent = loaded.rssCount ? `${loaded.rssCount} RSS-MELDUNGEN` : "RSS-FALLBACK";
  cards = new CardPool({
    THREE,
    root: cardsRoot,
    max: 72,
    onToggle: toggleCard,
    onClose: closeCard,
  });
  cardsRoot.object3D.visible = false;
  scene.dataset.ready = "true";
  scene.dataset.rssCount = String(loaded.rssCount);
  scene.dataset.manualPaused = "false";
  scene.dataset.closedCount = "0";
  scene.dataset.lastCloseSpawned = "0";
  browserButton.disabled = false;
  if (navigator.xr) {
    try {
      const supported = await navigator.xr.isSessionSupported("immersive-vr");
      if (supported) {
        vrButton.disabled = false;
      } else {
        vrButton.disabled = true;
        vrButton.textContent = "VR HIER NICHT VERFÜGBAR";
      }
    } catch {
      vrButton.disabled = true;
    }
  } else {
    vrButton.disabled = true;
    vrButton.textContent = "VR HIER NICHT VERFÜGBAR";
  }
}

function beginInitialization() {
  if (!initializationPromise) initializationPromise = initialize();
  return initializationPromise;
}

async function ensureInitialized() {
  if (!scene.hasLoaded) {
    await new Promise((resolve) => scene.addEventListener("loaded", resolve, { once: true }));
  }
  await beginInitialization();
}

browserButton.addEventListener("click", () => startExperience());
vrButton.addEventListener("click", () => startExperience({ enterVR: true }));
pauseAllButton.addEventListener("click", toggleAll);
vrPauseButton.addEventListener("click", toggleAll);
leftController.addEventListener("thumbstickmoved", onLeftAxis);
rightController.addEventListener("thumbstickmoved", onRightAxis);
rightController.addEventListener("abuttondown", toggleAll);
leftController.addEventListener("xbuttondown", toggleAll);

scene.addEventListener("enter-vr", () => {
  document.body.classList.add("in-vr");
  vrHud.setAttribute("visible", state.phase?.type !== "pause");
  vrPauseButton.classList.toggle("interactive", state.phase?.type !== "pause");
  if (!state.running) void startExperience();
  setTimeout(() => vrHelp.setAttribute("visible", false), 9000);
});

scene.addEventListener("exit-vr", () => {
  document.body.classList.remove("in-vr");
  vrHud.setAttribute("visible", false);
  vrPauseButton.classList.remove("interactive");
  leftAxis.set(0, 0);
  leftPointer.object3D.visible = false;
  rightPointer.object3D.visible = false;
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
      const urls = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => new URL(url).origin === location.origin);
      registration.active?.postMessage({ type: "CACHE_URLS", urls });
    } catch {}
  });
}

window.nachrichtenraumV2 = {
  getState: () => ({
    running: state.running,
    phase: state.phase?.label || "BEREIT",
    phaseType: state.phase?.type || "idle",
    cards: cards?.size || 0,
    pausedCards: cards?.pausedCount || 0,
    manualPaused: state.manualPaused,
    audioState: audio.state,
    rssCount: state.rssCount,
    closedCount: state.closedCount,
  }),
  toggleAll,
};

AFRAME.registerComponent("nachrichtenraum-loop", {
  tick(_time, deltaMilliseconds) {
    const now = performance.now();
    const delta = Math.min(deltaMilliseconds / 1000, 0.05);
    if (!state.running) {
      if (swarm) swarm.group.rotation.y = now * 0.000006;
      return;
    }
    const current = updatePhase(now);
    updatePointers();
    updateScene(delta, now, current);
  },
});
scene.setAttribute("nachrichtenraum-loop", "");

if (scene.hasLoaded) void beginInitialization();
else scene.addEventListener("loaded", beginInitialization, { once: true });
