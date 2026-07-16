import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { messageAt } from './data.js';

const sceneHost = document.querySelector('#scene');
const ui = {
  intro: document.querySelector('#intro'),
  enter: document.querySelector('#enter'),
  toggle: document.querySelector('#toggle'),
  add: document.querySelector('#add'),
  sound: document.querySelector('#sound'),
  vr: document.querySelector('#vr'),
  flash: document.querySelector('#flash'),
  elapsed: document.querySelector('#elapsed'),
  phase: document.querySelector('#phase'),
  intensity: document.querySelector('#intensity'),
  count: document.querySelector('#count'),
  sourceStatus: document.querySelector('#source-status')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f10);
scene.fog = new THREE.FogExp2(0x0d0f10, 0.029);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 160);
camera.position.set(0, 1.62, 2.8);
camera.rotation.order = 'YXZ';

const player = new THREE.Group();
scene.add(player);
player.add(camera);
sceneHost.dataset.playerX = '0.000';
sceneHost.dataset.playerZ = '0.000';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.xr.enabled = true;
sceneHost.append(renderer.domElement);

const tunnel = new THREE.Mesh(
  new THREE.CylinderGeometry(7.5, 7.5, 150, 48, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x171a1b, roughness: 1, metalness: 0, side: THREE.BackSide })
);
tunnel.rotation.x = Math.PI / 2;
tunnel.position.z = -67;
scene.add(tunnel);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 150, 1, 30),
  new THREE.MeshStandardMaterial({ color: 0x121415, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -67);
scene.add(floor);

const ribs = new THREE.Group();
const ribMaterial = new THREE.MeshBasicMaterial({ color: 0x2b2e2f, transparent: true, opacity: 0.28 });
for (let z = 1; z > -140; z -= 4) {
  const rib = new THREE.Mesh(new THREE.TorusGeometry(7.45, 0.018, 4, 64), ribMaterial);
  rib.position.set(0, 1.3, z);
  rib.rotation.x = Math.PI / 2;
  ribs.add(rib);
}
scene.add(ribs);

scene.add(new THREE.HemisphereLight(0xbfc6c8, 0x090a0b, 0.22));
const flashLight = new THREE.PointLight(0xffffff, 0, 16, 1.8);
scene.add(flashLight);

const messageGroup = new THREE.Group();
scene.add(messageGroup);
const cards = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const controllerRotation = new THREE.Matrix4();
let running = false;
let soundOn = true;
let startedAt = 0;
let elapsedBeforePause = 0;
let nextSpawnAt = 0;
let sequence = 0;
let flashPower = 0;
let liveMessages = [];
const movementKeys = new Set();
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const cameraWorldPosition = new THREE.Vector3();
const headBeforeTurn = new THREE.Vector3();
const headAfterTurn = new THREE.Vector3();
let snapTurnReady = true;

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function makeCardTexture(message, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f4f0';
  roundedRect(ctx, 0, 0, 900, 300, 7);
  ctx.fillStyle = '#17191a';
  ctx.font = '500 24px Arial';
  ctx.letterSpacing = '3px';
  ctx.fillText(message.source, 44, 48);
  ctx.fillStyle = '#737574';
  ctx.textAlign = 'right';
  ctx.font = '500 19px Arial';
  ctx.fillText(String(index + 1).padStart(3, '0'), 856, 48);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#111314';
  ctx.font = '600 47px Arial';
  const words = message.title.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = `${line}${line ? ' ' : ''}${word}`;
    if (ctx.measureText(test).width > 800 && line) { lines.push(line); line = word; }
    else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((text, i) => ctx.fillText(text, 44, 122 + i * 54));
  ctx.fillStyle = '#777a79';
  ctx.font = '500 18px Arial';
  ctx.fillText(`${message.category}  ·  ${message.age}`, 44, 266);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function cardPosition(index, close = false) {
  const golden = 2.399963;
  const angle = index * golden + (Math.random() - .5) * .45;
  const radius = close ? 1.1 + Math.random() * 2.3 : 1.8 + Math.random() * 3.1;
  const z = close ? -.45 - Math.random() * 5.5 : -4 - (index % 105) * .88 - Math.random() * 1.5;
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    1.6 + Math.sin(angle) * radius * .74,
    z
  );
}

function playTone(intensity) {
  if (!soundOn || !audio.context) return;
  const ctx = audio.context;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(720 + Math.random() * 480, now);
  osc.frequency.exponentialRampToValueAtTime(360, now + .11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.018 + intensity * .018, now + .008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + .14);
  osc.connect(gain).connect(audio.master);
  osc.start(now);
  osc.stop(now + .15);
}

function spawnCard(customMessage, close = false, quiet = false) {
  const message = customMessage || (liveMessages.length ? liveMessages[sequence % liveMessages.length] : messageAt(sequence));
  const material = new THREE.MeshBasicMaterial({
    map: makeCardTexture(message, sequence),
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(.6, .2), material);
  card.position.copy(cardPosition(sequence, close));
  camera.getWorldPosition(cameraWorldPosition);
  card.lookAt(cameraWorldPosition);
  card.userData = { born: clock.elapsedTime, targetScale: 1, drift: (Math.random() - .5) * .025, url: message.url || '' };
  card.scale.setScalar(.05);
  messageGroup.add(card);
  cards.push(card);
  sequence += 1;
  if (cards.length > 480) {
    const old = cards.shift();
    old.material.map.dispose();
    old.material.dispose();
    old.geometry.dispose();
    messageGroup.remove(old);
  }
  if (!quiet) {
    flashPower = 1;
    flashLight.position.copy(card.position);
    ui.flash.classList.remove('active');
    void ui.flash.offsetWidth;
    ui.flash.classList.add('active');
    playTone(currentIntensity());
  }
  updateReadout();
}

function currentElapsed() {
  return running ? elapsedBeforePause + (performance.now() - startedAt) / 1000 : elapsedBeforePause;
}

function currentIntensity() {
  return Math.min(1, currentElapsed() / 300);
}

function spawnInterval() {
  const p = currentIntensity();
  return THREE.MathUtils.lerp(4.8, .16, Math.pow(p, 1.65));
}

function updateReadout() {
  const seconds = Math.floor(currentElapsed());
  ui.elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const p = currentIntensity();
  ui.intensity.style.height = `${Math.max(4, p * 100)}%`;
  ui.count.textContent = String(cards.length).padStart(3, '0');
  ui.phase.textContent = !running && seconds === 0 ? 'BEREIT' : !running ? 'ANGEHALTEN' : p < .2 ? 'ZUSTROM' : p < .55 ? 'VERDICHTUNG' : p < .85 ? 'ÜBERLASTUNG' : 'VERLUST';
}

const audio = { context: null, master: null, drone: null };
function initAudio() {
  if (audio.context) { audio.context.resume(); return; }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio.context = new AudioContext();
  audio.master = audio.context.createGain();
  audio.master.gain.value = soundOn ? .55 : 0;
  audio.master.connect(audio.context.destination);
  const drone = audio.context.createOscillator();
  const droneGain = audio.context.createGain();
  drone.type = 'sine';
  drone.frequency.value = 42;
  droneGain.gain.value = .012;
  drone.connect(droneGain).connect(audio.master);
  drone.start();
  audio.drone = droneGain;
}

function start() {
  initAudio();
  if (!running) {
    startedAt = performance.now();
    running = true;
    nextSpawnAt = currentElapsed() + .25;
  }
  ui.intro.classList.add('hidden');
  ui.toggle.textContent = 'PAUSE';
  updateReadout();
}

function pause() {
  elapsedBeforePause = currentElapsed();
  running = false;
  ui.toggle.textContent = 'WEITER';
  updateReadout();
}

ui.enter.addEventListener('click', start);
ui.toggle.addEventListener('click', () => running ? pause() : start());
ui.add.addEventListener('click', () => { initAudio(); spawnCard(null, true); });
ui.sound.addEventListener('click', () => {
  soundOn = !soundOn;
  ui.sound.textContent = soundOn ? 'TON AN' : 'TON AUS';
  ui.sound.setAttribute('aria-pressed', String(soundOn));
  if (audio.master) audio.master.gain.setTargetAtTime(soundOn ? .55 : 0, audio.context.currentTime, .04);
});

const xrButton = VRButton.createButton(renderer);
document.body.append(xrButton);
ui.vr.addEventListener('click', () => xrButton.click());
renderer.xr.addEventListener('sessionstart', () => { start(); ui.vr.textContent = 'VR AKTIV'; });
renderer.xr.addEventListener('sessionend', () => { ui.vr.textContent = 'VR'; });

function openCardUrl(card) {
  if (!card?.userData.url) return;
  const url = new URL(card.userData.url);
  if (!['www.tagesschau.de', 'tagesschau.de', 'taz.de', 'www.taz.de'].includes(url.hostname)) return;
  window.open(url.href, '_blank', 'noopener');
}

function openFirstCardHit() {
  const hit = raycaster.intersectObjects(cards, false)[0];
  if (hit) openCardUrl(hit.object);
}

for (let index = 0; index < 2; index += 1) {
  const controller = renderer.xr.getController(index);
  controller.addEventListener('select', function selectCard() {
    controllerRotation.identity().extractRotation(this.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(this.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(controllerRotation);
    openFirstCardHit();
  });
  player.add(controller);
}

let dragging = false;
let pointerX = 0;
let pointerY = 0;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerMoved = false;
let yaw = 0;
let pitch = 0;
renderer.domElement.addEventListener('pointerdown', event => {
  dragging = true;
  pointerX = event.clientX;
  pointerY = event.clientY;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  pointerMoved = false;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging || renderer.xr.isPresenting) return;
  if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 6) pointerMoved = true;
  yaw -= (event.clientX - pointerX) * .0032;
  pitch -= (event.clientY - pointerY) * .0032;
  pitch = THREE.MathUtils.clamp(pitch, -1.28, 1.28);
  pointerX = event.clientX;
  pointerY = event.clientY;
});
renderer.domElement.addEventListener('pointerup', event => {
  dragging = false;
  if (pointerMoved || renderer.xr.isPresenting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);
  openFirstCardHit();
});
renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
window.addEventListener('keydown', event => {
  if (!movementCodes.has(event.code)) return;
  movementKeys.add(event.code);
  if (!event.repeat && !renderer.xr.isPresenting) {
    const sideways = Number(event.code === 'KeyD' || event.code === 'ArrowRight') - Number(event.code === 'KeyA' || event.code === 'ArrowLeft');
    const forwards = Number(event.code === 'KeyW' || event.code === 'ArrowUp') - Number(event.code === 'KeyS' || event.code === 'ArrowDown');
    movePlayer(sideways, forwards, .08, camera);
  }
  event.preventDefault();
});
window.addEventListener('keyup', event => {
  movementKeys.delete(event.code);
});
window.addEventListener('blur', () => movementKeys.clear());

function movePlayer(sideways, forwards, speed, viewCamera) {
  if (Math.abs(sideways) < .08 && Math.abs(forwards) < .08) return;
  viewCamera.getWorldDirection(moveForward);
  moveForward.y = 0;
  if (moveForward.lengthSq() < .001) moveForward.set(0, 0, -1);
  moveForward.normalize();
  moveRight.crossVectors(moveForward, worldUp).normalize();
  moveDirection.copy(moveForward).multiplyScalar(forwards).addScaledVector(moveRight, sideways);
  if (moveDirection.lengthSq() > 1) moveDirection.normalize();
  player.position.addScaledVector(moveDirection, speed);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -5.8, 5.8);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -136, 4);
  sceneHost.dataset.playerX = player.position.x.toFixed(3);
  sceneHost.dataset.playerZ = player.position.z.toFixed(3);
}

function updateDesktopMovement(delta) {
  if (renderer.xr.isPresenting) return;
  const sideways = Number(movementKeys.has('KeyD') || movementKeys.has('ArrowRight')) - Number(movementKeys.has('KeyA') || movementKeys.has('ArrowLeft'));
  const forwards = Number(movementKeys.has('KeyW') || movementKeys.has('ArrowUp')) - Number(movementKeys.has('KeyS') || movementKeys.has('ArrowDown'));
  movePlayer(sideways, forwards, delta * 2.5, camera);
}

function controllerStick(gamepad) {
  if (!gamepad?.axes?.length) return { x: 0, y: 0 };
  const axes = gamepad.axes;
  const x = axes.length >= 4 ? axes[axes.length - 2] : axes[0];
  const y = axes.length >= 4 ? axes[axes.length - 1] : axes[1];
  return {
    x: Math.abs(x || 0) > .16 ? x : 0,
    y: Math.abs(y || 0) > .16 ? y : 0
  };
}

function snapTurn(x, xrCamera) {
  if (Math.abs(x) < .3) { snapTurnReady = true; return; }
  if (!snapTurnReady || Math.abs(x) < .72) return;
  xrCamera.getWorldPosition(headBeforeTurn);
  player.rotation.y -= Math.sign(x) * Math.PI / 6;
  player.updateMatrixWorld(true);
  xrCamera.getWorldPosition(headAfterTurn);
  player.position.add(headBeforeTurn.sub(headAfterTurn));
  player.updateMatrixWorld(true);
  snapTurnReady = false;
}

function updateXRMovement(delta) {
  const session = renderer.xr.getSession();
  if (!session) return;
  const xrCamera = renderer.xr.getCamera(camera);
  let usedMovementStick = false;
  for (const source of session.inputSources) {
    const stick = controllerStick(source.gamepad);
    if (source.handedness === 'right') {
      snapTurn(stick.x, xrCamera);
      continue;
    }
    if (!usedMovementStick && (source.handedness === 'left' || source.handedness === 'none')) {
      movePlayer(stick.x, -stick.y, delta * 2.1, xrCamera);
      usedMovementStick = true;
    }
  }
}

window.addEventListener('deviceorientation', event => {
  if (dragging || renderer.xr.isPresenting || event.alpha == null) return;
  yaw = THREE.MathUtils.degToRad(-event.alpha);
  pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(event.beta - 70, -70, 70));
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});

window.nachrichtenraum = {
  getPosition() {
    return { x: player.position.x, z: player.position.z };
  },
  pushMessage({ source = 'WHATSAPP', title, age = 'gerade eben', category = 'PUBLIKUM' }) {
    if (!title) return;
    spawnCard({ source, title: String(title).slice(0, 110), age, category }, true);
  }
};

async function pollLiveMessages() {
  const endpoint = import.meta.env?.VITE_MESSAGE_ENDPOINT;
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) return;
    const incoming = await response.json();
    for (const item of incoming.messages || []) window.nachrichtenraum.pushMessage(item);
  } catch { /* Live data remains optional. */ }
}
setInterval(pollLiveMessages, 8000);

function relativeAge(publishedAt) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(publishedAt)) / 60000));
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

function clearCards() {
  while (cards.length) {
    const card = cards.pop();
    card.material.map.dispose();
    card.material.dispose();
    card.geometry.dispose();
    messageGroup.remove(card);
  }
}

async function loadRssMessages() {
  const candidates = ['./feeds.json', './public/feeds.json'];
  for (const path of candidates) {
    try {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) continue;
      const payload = await response.json();
      const messages = (payload.messages || []).filter(item => item.title && item.source);
      if (!messages.length) continue;
      liveMessages = messages.map(item => ({ ...item, age: relativeAge(item.publishedAt) }));
      clearCards();
      sequence = 0;
      for (let index = 0; index < 132; index += 1) spawnCard(null, index < 16, true);
      const updated = new Date(payload.updatedAt);
      ui.sourceStatus.textContent = `LIVE RSS · STAND ${updated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      return;
    } catch {
      continue;
    }
  }
  ui.sourceStatus.textContent = 'DEMO-INHALTE · RSS NICHT ERREICHBAR';
}

for (let i = 0; i < 132; i += 1) spawnCard(null, i < 16, true);
loadRssMessages();

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), .05);
  const now = clock.elapsedTime;
  if (!renderer.xr.isPresenting) camera.rotation.set(pitch, yaw, 0);
  updateDesktopMovement(delta);
  updateXRMovement(delta);

  if (running) {
    const elapsed = currentElapsed();
    if (elapsed >= nextSpawnAt) {
      const batch = currentIntensity() > .7 ? Math.ceil(1 + currentIntensity() * 3) : 1;
      for (let i = 0; i < batch; i += 1) spawnCard(null, Math.random() < .14);
      nextSpawnAt = elapsed + spawnInterval();
    }
    messageGroup.position.z += delta * (.035 + currentIntensity() * .085);
    updateReadout();
  }

  cards.forEach(card => {
    const age = now - card.userData.born;
    const ease = 1 - Math.exp(-age * 7);
    const scale = card.userData.targetScale * ease;
    card.scale.setScalar(scale);
    card.material.opacity = Math.min(1, age * 5);
    card.position.y += card.userData.drift * delta;
  });

  flashPower *= Math.pow(.018, delta);
  flashLight.intensity = flashPower * 48;
  if (audio.drone && running) audio.drone.gain.setTargetAtTime(.01 + currentIntensity() * .035, audio.context.currentTime, .5);
  renderer.render(scene, camera);
});
