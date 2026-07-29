import { fallbackMessages } from "./data.js";

const scene = document.querySelector("#xr-scene");
const cameraEl = document.querySelector("#viewer");
const controllerEl = document.querySelector("#right-controller");
const cursorEl = document.querySelector("#controller-cursor");
const vrMotionToggleEl = document.querySelector("#vr-motion-toggle");
const cardsRoot = document.querySelector("#news-root");
const swarmRoot = document.querySelector("#data-swarm");
const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const vrButton = document.querySelector("#vr-button");
const hud = document.querySelector("#hud");
const help = document.querySelector("#desktop-help");
const phaseLabel = document.querySelector("#phase-label");
const timer = document.querySelector("#timer");
const messageCount = document.querySelector("#message-count");
const feedStatus = document.querySelector("#feed-status");
const motionToggle = document.querySelector("#motion-toggle");

const THREE = window.THREE;
const cardWidth = 1.62;
const cardHeight = 0.8;
const cardLimit = 132;
const stages = [
  { type: "active", label: "PHASE I · ÜBERFLUTUNG", duration: 20, intensity: 1, target: 48, startRate: 780, endRate: 150, batch: 1 },
  { type: "pause", label: "STILLE", duration: 6 },
  { type: "active", label: "PHASE II · ESKALATION", duration: 30, intensity: 1.35, target: 76, startRate: 480, endRate: 82, batch: 2 },
  { type: "pause", label: "STILLE", duration: 6 },
  { type: "active", label: "PHASE III · SCHNELL", duration: 20, intensity: 1.6, target: 94, startRate: 310, endRate: 62, batch: 2 },
  { type: "pause", label: "STILLE", duration: 6 },
  { type: "active", label: "PHASE IV · SCHNELLER", duration: 20, intensity: 1.9, target: 114, startRate: 220, endRate: 45, batch: 3 },
  { type: "pause", label: "STILLE", duration: 6 },
  { type: "active", label: "PHASE V · MAXIMUM", duration: 20, intensity: 2.3, target: 132, startRate: 150, endRate: 34, batch: 3 },
  { type: "pause", label: "STILLE", duration: 6 },
];
const cycleDuration = stages.reduce((sum, stage) => sum + stage.duration, 0);
const categoryColors = {
  POLITIK: "#123c75",
  INNENPOLITIK: "#133f78",
  AUSLANDSPOLITIK: "#173560",
  AUSLAND: "#173560",
  "WIRTSCHAFT & PREISE": "#0c496a",
  WIRTSCHAFT: "#0c496a",
  MIETEN: "#24456e",
  RENTE: "#343e65",
  "GESUNDHEIT & PSYCHE": "#184f61",
  GESUNDHEIT: "#184f61",
  "KLIMA & UMWELT": "#155266",
  KLIMA: "#155266",
  STUDIUM: "#2d3f73",
  "KARRIERE & STUDIUM": "#27476b",
  KARRIERE: "#27476b",
  NACHRICHTEN: "#163b68",
  NEWS: "#163b68",
};

let messages = fallbackMessages.map(normalizeMessage);
let cards = [];
let swarm;
let running = false;
let allMessagesPaused = false;
let startedAt = 0;
let activeStageIndex = -1;
let lastSpawnAt = 0;
let lastSoundAt = 0;
let closedCount = 0;
let pausedCount = 0;
let seededTestCard = false;
let audioContext;
let audioMaster;
let animationFrame;
let lastFrame = performance.now();
let testOffset = 0;
let vrToggleMesh;
let vrToggleTexture;

const pointer = new THREE.Vector2();
const pointerRay = new THREE.Raycaster();
const cameraPosition = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const joystickAxis = new THREE.Vector2();
const joystickCursor = new THREE.Vector2();

const params = new URLSearchParams(location.search);
const localTesting = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const interactionTest = localTesting && params.get("test") === "1";
if (localTesting && params.has("start")) testOffset = Number(params.get("start")) || 0;

function stripMarkup(value = "") {
  const text = document.createElement("textarea");
  text.innerHTML = String(value).replace(/<[^>]*>/g, " ");
  return text.value.replace(/\s+/g, " ").trim();
}

function normalizeMessage(item = {}) {
  const title = stripMarkup(item.title).slice(0, 150) || "Neue Meldung";
  const excerpt = stripMarkup(item.excerpt || item.description || item.summary).slice(0, 220);
  return {
    title,
    excerpt: excerpt || "Eine neue Entwicklung erzeugt weitere Fragen, Reaktionen und Folgeprobleme.",
    source: stripMarkup(item.source || "RSS").toUpperCase().slice(0, 26),
    category: stripMarkup(item.category || "NEWS").toUpperCase().slice(0, 22),
    link: item.link || item.url || "",
  };
}

async function loadFeeds() {
  const paths = ["./feeds.json", "./public/feeds.json"];
  for (const path of paths) {
    try {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) continue;
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : payload.messages;
      if (Array.isArray(list) && list.length) {
        messages = [...list.map(normalizeMessage), ...fallbackMessages.map(normalizeMessage)];
        feedStatus.textContent = `${list.length} RSS-MELDUNGEN`;
        scene.dataset.feedCount = String(list.length);
        return;
      }
    } catch {
      feedStatus.textContent = "RSS-FALLBACK";
    }
  }
  messages = fallbackMessages.map(normalizeMessage);
  feedStatus.textContent = "RSS-FALLBACK";
  scene.dataset.feedCount = "0";
}

function wrapText(context, value, maxWidth, maxLines) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = "";
  while (words.length && lines.length < maxLines) {
    const word = words.shift();
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length) {
    let finalLine = lines.at(-1);
    while (context.measureText(`${finalLine}…`).width > maxWidth && finalLine.length > 4) {
      finalLine = finalLine.slice(0, -1);
    }
    lines[lines.length - 1] = `${finalLine.trim()}…`;
  }
  return lines;
}

function drawCardTexture(message) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const accent = categoryColors[message.category] || categoryColors.NEWS;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 14, canvas.height);
  context.fillRect(14, 0, canvas.width - 14, 13);
  context.fillStyle = "#090d16";
  context.fillRect(449, 18, 46, 46);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(462, 31);
  context.lineTo(482, 51);
  context.moveTo(482, 31);
  context.lineTo(462, 51);
  context.stroke();
  context.fillStyle = "#1b2d4d";
  context.font = "700 14px Arial";
  context.fillText(`${message.source} · ${message.category}`, 34, 47);
  context.fillStyle = "#070a0f";
  context.font = "700 27px Arial";
  const titleLines = wrapText(context, message.title, 397, 3);
  titleLines.forEach((line, index) => context.fillText(line, 34, 87 + index * 30));
  const excerptY = 103 + titleLines.length * 30;
  context.fillStyle = "#313744";
  context.font = "400 16px Arial";
  const excerptLines = wrapText(context, message.excerpt, 440, 2);
  excerptLines.forEach((line, index) => context.fillText(line, 34, excerptY + index * 21));
  context.fillStyle = accent;
  context.fillRect(34, 232, 108, 5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function drawVrToggleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const context = canvas.getContext("2d");
  context.fillStyle = allMessagesPaused ? "#98bfff" : "#071327";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = allMessagesPaused ? "#07101f" : "#ffffff";
  context.font = "700 28px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(allMessagesPaused ? "NACHRICHTEN FORTSETZEN" : "ALLE NACHRICHTEN ANHALTEN", 256, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function buildVrToggle() {
  const geometry = new THREE.PlaneGeometry(0.72, 0.158);
  vrToggleTexture = drawVrToggleTexture();
  const material = new THREE.MeshBasicMaterial({
    map: vrToggleTexture,
    transparent: false,
    depthTest: false,
    toneMapped: false,
  });
  vrToggleMesh = new THREE.Mesh(geometry, material);
  vrToggleMesh.renderOrder = 1000;
  vrToggleMesh.userData.action = "toggleAll";
  vrMotionToggleEl.setObject3D("mesh", vrToggleMesh);
}

async function toggleAllMessages() {
  if (!running || stages[activeStageIndex]?.type === "pause") return;
  allMessagesPaused = !allMessagesPaused;
  motionToggle.classList.toggle("is-paused", allMessagesPaused);
  motionToggle.textContent = allMessagesPaused ? "NACHRICHTEN FORTSETZEN" : "ALLE NACHRICHTEN ANHALTEN";
  scene.setAttribute("data-all-paused", String(allMessagesPaused));
  if (vrToggleMesh) {
    const previous = vrToggleTexture;
    vrToggleTexture = drawVrToggleTexture();
    vrToggleMesh.material.map = vrToggleTexture;
    vrToggleMesh.material.needsUpdate = true;
    previous?.dispose();
  }
  if (allMessagesPaused && audioContext?.state === "running") {
    await audioContext.suspend();
  } else if (!allMessagesPaused && audioContext?.state === "suspended") {
    await audioContext.resume();
    playPlop(0.9);
  }
  scene.dataset.audioState = audioContext?.state || "unavailable";
}

function randomPoint(radiusMin = 2.4, radiusMax = 8.6) {
  const radius = THREE.MathUtils.lerp(radiusMin, radiusMax, Math.pow(Math.random(), 0.68));
  const theta = Math.random() * Math.PI * 2;
  const vertical = THREE.MathUtils.lerp(-0.92, 0.92, Math.random());
  const planar = Math.sqrt(1 - vertical * vertical);
  return new THREE.Vector3(
    Math.cos(theta) * planar * radius,
    1.45 + vertical * radius * 0.72,
    Math.sin(theta) * planar * radius,
  );
}

function removeOldestCard() {
  const oldest = cards[0];
  if (oldest) destroyCard(oldest, false);
}

function createCard(options = {}) {
  if (cards.length >= cardLimit) removeOldestCard();
  const message = options.message || messages[Math.floor(Math.random() * messages.length)];
  const texture = drawCardTexture(message);
  const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const entity = document.createElement("a-entity");
  entity.className = "news-card";
  entity.setObject3D("mesh", mesh);
  cardsRoot.appendChild(entity);
  const position = options.position || randomPoint();
  entity.object3D.position.copy(position);
  cameraEl.object3D.getWorldPosition(cameraPosition);
  entity.object3D.lookAt(cameraPosition);
  entity.object3D.rotateZ(THREE.MathUtils.randFloatSpread(0.16));
  entity.object3D.scale.setScalar(options.scale || THREE.MathUtils.randFloat(0.88, 1.08));
  const direction = position.clone().sub(cameraPosition).normalize();
  const tangent = new THREE.Vector3(-direction.z, THREE.MathUtils.randFloatSpread(0.32), direction.x).normalize();
  const card = {
    entity,
    mesh,
    texture,
    geometry,
    material,
    message,
    bornAt: performance.now(),
    pitch: THREE.MathUtils.randFloat(0.72, 1.65),
    velocity: tangent.multiplyScalar(THREE.MathUtils.randFloat(0.018, 0.065)),
    wave: Math.random() * Math.PI * 2,
    paused: false,
  };
  mesh.userData.card = card;
  cards.push(card);
  updateCardCount();
  if (running && options.sound !== false) playPlop(card.pitch);
  return card;
}

function destroyCard(card, interaction = true) {
  const index = cards.indexOf(card);
  if (index < 0) return;
  cards.splice(index, 1);
  if (card.paused) pausedCount = Math.max(0, pausedCount - 1);
  card.entity.removeObject3D("mesh");
  card.entity.remove();
  card.geometry.dispose();
  card.material.dispose();
  card.texture.dispose();
  if (interaction) {
    closedCount += 1;
    playWhoosh(card.pitch);
    createCard();
    createCard();
  }
  scene.setAttribute("data-closed-count", String(closedCount));
  updateCardCount();
}

function updateCardCount() {
  messageCount.textContent = pausedCount
    ? `${cards.length} NACHRICHTEN · ${pausedCount} ANGEHALTEN`
    : `${cards.length} NACHRICHTEN`;
  scene.dataset.cardCount = String(cards.length);
  scene.setAttribute("data-paused-count", String(pausedCount));
}

function toggleCardPaused(card) {
  if (!card || !cards.includes(card)) return;
  card.paused = !card.paused;
  pausedCount += card.paused ? 1 : -1;
  card.material.color.set(card.paused ? 0x86aee8 : 0xffffff);
  card.entity.setAttribute("data-paused", String(card.paused));
  playPlop(card.paused ? 0.58 : 1.18);
  updateCardCount();
}

function buildSwarm() {
  const pointCount = 920;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const points = [];
  for (let index = 0; index < pointCount; index += 1) {
    const point = randomPoint(1.8, 13.5);
    points.push(point);
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
    colors[index * 3] = THREE.MathUtils.randFloat(0.08, 0.2);
    colors[index * 3 + 1] = THREE.MathUtils.randFloat(0.32, 0.6);
    colors[index * 3 + 2] = THREE.MathUtils.randFloat(0.72, 1);
  }
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const pointMaterial = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pointMesh = new THREE.Points(pointGeometry, pointMaterial);
  const lineCount = 330;
  const linePositions = new Float32Array(lineCount * 6);
  for (let index = 0; index < lineCount; index += 1) {
    const first = points[Math.floor(Math.random() * points.length)];
    let second = points[Math.floor(Math.random() * points.length)];
    let attempts = 0;
    while (first.distanceTo(second) > 3.2 && attempts < 10) {
      second = points[Math.floor(Math.random() * points.length)];
      attempts += 1;
    }
    linePositions.set([first.x, first.y, first.z, second.x, second.y, second.z], index * 6);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x174a92,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
  const group = new THREE.Group();
  group.add(pointMesh, lineMesh);
  swarmRoot.setObject3D("mesh", group);
  swarm = { group, pointMaterial, lineMaterial };
}

function initAudio() {
  if (audioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext = new AudioContext();
  audioMaster = audioContext.createGain();
  audioMaster.gain.value = 0.38;
  audioMaster.connect(audioContext.destination);
  scene.dataset.audioState = audioContext.state;
}

function playPlop(pitch = 1) {
  if (!audioContext || audioContext.state !== "running") return;
  const nowMs = performance.now();
  if (nowMs - lastSoundAt < 48) return;
  lastSoundAt = nowMs;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = Math.random() > 0.45 ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(180 * pitch, now);
  oscillator.frequency.exponentialRampToValueAtTime(70 * pitch, now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  oscillator.connect(gain);
  gain.connect(audioMaster);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

function playWhoosh(pitch = 1) {
  if (!audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const length = Math.floor(audioContext.sampleRate * 0.2);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length);
  }
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1300 * pitch, now);
  filter.frequency.exponentialRampToValueAtTime(210 * pitch, now + 0.2);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioMaster);
  source.start(now);
}

function currentStage(elapsed) {
  let cycleTime = ((elapsed % cycleDuration) + cycleDuration) % cycleDuration;
  for (let index = 0; index < stages.length; index += 1) {
    if (cycleTime < stages[index].duration) {
      return { index, stage: stages[index], progress: cycleTime / stages[index].duration };
    }
    cycleTime -= stages[index].duration;
  }
  return { index: 0, stage: stages[0], progress: 0 };
}

async function enterStage(index, stage) {
  activeStageIndex = index;
  phaseLabel.textContent = stage.label;
  scene.dataset.phase = stage.label;
  scene.dataset.stageType = stage.type;
  if (stage.type === "pause") {
    document.body.classList.add("is-silent");
    cardsRoot.object3D.visible = false;
    swarmRoot.object3D.visible = false;
    if (scene.is("vr-mode")) {
      cursorEl.setAttribute("visible", false);
      vrMotionToggleEl.setAttribute("visible", false);
    }
    if (audioContext?.state === "running") await audioContext.suspend();
    scene.dataset.audioState = audioContext?.state || "unavailable";
    scene.dataset.swarmVisible = "false";
    return;
  }
  document.body.classList.remove("is-silent");
  cardsRoot.object3D.visible = true;
  swarmRoot.object3D.visible = true;
  if (scene.is("vr-mode")) {
    cursorEl.setAttribute("visible", true);
    vrMotionToggleEl.setAttribute("visible", true);
  }
  if (!allMessagesPaused && audioContext?.state === "suspended") await audioContext.resume();
  scene.dataset.audioState = audioContext?.state || "unavailable";
  scene.dataset.swarmVisible = "true";
  lastSpawnAt = 0;
  if (!cards.length) {
    const initialCount = index === 0 ? 12 : 28;
    for (let count = 0; count < initialCount; count += 1) createCard({ sound: false });
  }
}

function updateCards(delta, intensity, now) {
  cameraEl.object3D.getWorldPosition(cameraPosition);
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    if (card.paused) continue;
    const age = (now - card.bornAt) / 1000;
    card.entity.object3D.position.addScaledVector(card.velocity, delta * intensity);
    card.entity.object3D.position.y += Math.sin(age * 1.25 + card.wave) * 0.0016 * intensity;
    if (index % 4 === Math.floor(now / 180) % 4) {
      lookTarget.copy(cameraPosition);
      card.entity.object3D.lookAt(lookTarget);
      card.entity.object3D.rotateZ(Math.sin(card.wave + age * 0.18) * 0.045);
    }
    const distance = card.entity.object3D.position.distanceTo(cameraPosition);
    if (distance > 14 || distance < 1.15) {
      card.entity.object3D.position.copy(randomPoint());
      card.entity.object3D.lookAt(cameraPosition);
    }
  }
}

function updateSwarm(now, intensity) {
  if (!swarm) return;
  swarm.group.rotation.y = now * 0.000018 * intensity;
  swarm.group.rotation.x = Math.sin(now * 0.00009) * 0.035;
  swarm.pointMaterial.opacity = 0.56 + Math.sin(now * 0.0025) * 0.16;
  swarm.lineMaterial.opacity = 0.1 + intensity * 0.038;
}

function tick(now) {
  animationFrame = requestAnimationFrame(tick);
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (!running) {
    updateSwarm(now, 0.35);
    return;
  }
  const elapsed = (now - startedAt) / 1000 + testOffset;
  const state = currentStage(elapsed);
  if (state.index !== activeStageIndex) enterStage(state.index, state.stage);
  const minutes = Math.floor((elapsed % cycleDuration) / 60);
  const seconds = Math.floor(elapsed % 60);
  timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (state.stage.type === "pause") return;
  const rate = THREE.MathUtils.lerp(state.stage.startRate, state.stage.endRate, state.progress);
  const target = Math.round(THREE.MathUtils.lerp(12, state.stage.target, Math.pow(state.progress, 0.6)));
  if (!allMessagesPaused && !interactionTest && now - lastSpawnAt >= rate && cards.length < target) {
    lastSpawnAt = now;
    for (let count = 0; count < state.stage.batch && cards.length < target; count += 1) createCard();
  }
  if (!allMessagesPaused) updateCards(delta, state.stage.intensity, now);
  updateSwarm(now, state.stage.intensity);
  updateJoystickCursor(delta);
}

function updateJoystickCursor(delta) {
  if (!scene.is("vr-mode")) return;
  const deadzone = 0.14;
  const x = Math.abs(joystickAxis.x) > deadzone ? joystickAxis.x : 0;
  const y = Math.abs(joystickAxis.y) > deadzone ? joystickAxis.y : 0;
  joystickCursor.x = THREE.MathUtils.clamp(joystickCursor.x + x * delta * 1.45, -0.92, 0.92);
  joystickCursor.y = THREE.MathUtils.clamp(joystickCursor.y - y * delta * 1.45, -0.82, 0.82);
  const camera = cameraEl.getObject3D("camera");
  const distance = 1.05;
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
  cursorEl.object3D.position.set(
    joystickCursor.x * halfHeight * camera.aspect,
    joystickCursor.y * halfHeight,
    -distance,
  );
}

function activateAtPointer(pointerPosition) {
  if (!running || activeStageIndex < 0 || stages[activeStageIndex].type === "pause") return;
  const camera = cameraEl.getObject3D("camera");
  pointerRay.setFromCamera(pointerPosition, camera);
  const targets = vrToggleMesh && scene.is("vr-mode")
    ? [vrToggleMesh, ...cards.map((card) => card.mesh)]
    : cards.map((card) => card.mesh);
  const hit = pointerRay.intersectObjects(targets, false)[0];
  if (hit?.object?.userData.action === "toggleAll") {
    toggleAllMessages();
    return;
  }
  if (!hit?.object?.userData.card) return;
  if (hit.uv && hit.uv.x > 0.79 && hit.uv.y > 0.7) {
    destroyCard(hit.object.userData.card, true);
    return;
  }
  toggleCardPaused(hit.object.userData.card);
}

function activateControllerCursor() {
  activateAtPointer(joystickCursor);
}

function updateJoystickAxis(event) {
  const detail = event.detail || {};
  if (Number.isFinite(detail.x) && Number.isFinite(detail.y)) {
    joystickAxis.set(detail.x, detail.y);
    return;
  }
  const axis = detail.axis;
  if (Array.isArray(axis) && axis.length >= 2) {
    joystickAxis.set(axis.at(-2) || 0, axis.at(-1) || 0);
  }
}

function checkDesktopClose(event) {
  if (!running || scene.is("vr-mode") || stages[activeStageIndex]?.type === "pause") return;
  if (performance.now() - startedAt < 700) return;
  const canvas = scene.canvas;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  activateAtPointer(pointer);
}

function seedTestCard() {
  if (!interactionTest || seededTestCard) return;
  seededTestCard = true;
  createCard({
    message: normalizeMessage(fallbackMessages[0]),
    position: new THREE.Vector3(0, 1.6, -2.25),
    scale: 1.2,
    sound: false,
  });
}

function attachDesktopInteraction() {
  if (!scene.canvas || scene.canvas.dataset.newsInteraction === "true") return;
  scene.canvas.dataset.newsInteraction = "true";
  scene.canvas.addEventListener("click", checkDesktopClose);
}

async function startExperience({ enterVR = false } = {}) {
  if (!running) {
    initAudio();
    if (audioContext?.state === "suspended") await audioContext.resume();
    startScreen.classList.add("is-hidden");
    hud.classList.add("is-visible");
    help.classList.add("is-visible");
    motionToggle.classList.add("is-visible");
    running = true;
    startedAt = performance.now();
    activeStageIndex = -1;
    seedTestCard();
  }
  if (enterVR && !scene.is("vr-mode")) {
    try {
      await scene.enterVR();
    } catch {
      vrButton.textContent = "VR NICHT VERFÜGBAR";
    }
  }
}

scene.addEventListener("loaded", async () => {
  attachDesktopInteraction();
  buildSwarm();
  buildVrToggle();
  await loadFeeds();
  swarmRoot.object3D.visible = true;
  cardsRoot.object3D.visible = false;
  scene.setAttribute("data-closed-count", "0");
  scene.setAttribute("data-paused-count", "0");
  scene.setAttribute("data-all-paused", "false");
  if (navigator.xr) {
    try {
      const supported = await navigator.xr.isSessionSupported("immersive-vr");
      vrButton.hidden = !supported;
    } catch {
      vrButton.hidden = true;
    }
  } else {
    vrButton.hidden = true;
  }
  scene.dataset.ready = "true";
});

scene.addEventListener("render-target-loaded", () => {
  attachDesktopInteraction();
});
scene.addEventListener("enter-vr", () => {
  document.body.classList.add("in-vr");
  const interactionVisible = stages[activeStageIndex]?.type !== "pause";
  cursorEl.setAttribute("visible", interactionVisible);
  vrMotionToggleEl.setAttribute("visible", interactionVisible);
  if (!running) startExperience();
});
scene.addEventListener("exit-vr", () => {
  document.body.classList.remove("in-vr");
  cursorEl.setAttribute("visible", false);
  vrMotionToggleEl.setAttribute("visible", false);
  joystickAxis.set(0, 0);
});
controllerEl.addEventListener("thumbstickmoved", updateJoystickAxis);
controllerEl.addEventListener("axismove", updateJoystickAxis);
controllerEl.addEventListener("triggerdown", activateControllerCursor);
controllerEl.addEventListener("thumbstickdown", activateControllerCursor);
startButton.addEventListener("click", () => startExperience());
vrButton.addEventListener("click", () => startExperience({ enterVR: true }));
motionToggle.addEventListener("click", () => toggleAllMessages());
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "x" && running && cards.length) {
    const nearest = cards
      .map((card) => ({ card, distance: card.entity.object3D.position.distanceTo(cameraEl.object3D.position) }))
      .sort((a, b) => a.distance - b.distance)[0]?.card;
    if (nearest) destroyCard(nearest, true);
  }
});
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  audioContext?.close();
});

window.nachrichtenraum = {
  getState: () => ({
    running,
    phase: scene.dataset.phase,
    stageType: scene.dataset.stageType,
    cards: cards.length,
    closedCount,
    pausedCount,
    allMessagesPaused,
    audioState: audioContext?.state || "unavailable",
    rssMessages: Number(scene.dataset.feedCount || 0),
  }),
  closeNearest: () => {
    if (cards[0]) destroyCard(cards[0], true);
  },
  pauseNearest: () => {
    if (cards[0]) toggleCardPaused(cards[0]);
  },
};

loadFeeds();
attachDesktopInteraction();
animationFrame = requestAnimationFrame(tick);
