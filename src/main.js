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
  elapsed: document.querySelector('#elapsed'),
  phase: document.querySelector('#phase'),
  intensity: document.querySelector('#intensity'),
  count: document.querySelector('#count'),
  sourceStatus: document.querySelector('#source-status')
};

const phases = [
  { id: 'onset', label: 'ANLAUF', start: 0, end: 10, speed: 2.8, level: 2.5, interval: .55, batch: 1, breath: false, hold: 3.8, surround: .35 },
  { id: 'acceleration', label: 'BESCHLEUNIGUNG', start: 10, end: 22, speed: 4.8, level: 4, interval: .24, batch: 2, breath: false, hold: 2.6, surround: .55 },
  { id: 'flood', label: 'FLUT', start: 22, end: 32, speed: 7, level: 5.2, interval: .12, batch: 3, breath: false, hold: 1.7, surround: .72 },
  { id: 'overload', label: 'ÜBERLASTUNG', start: 32, end: 40, speed: 9, level: 6, interval: .075, batch: 4, breath: false, hold: 1, surround: .86 },
  { id: 'silence', label: 'STILLE', start: 40, end: Infinity, speed: 0, level: 0, interval: Infinity, batch: 0, breath: false, hold: 0, surround: 0 }
];
const timelineLength = 40;
const localTempo = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? THREE.MathUtils.clamp(Number(new URLSearchParams(location.search).get('tempo')) || 1, 1, 60)
  : 1;
const localStart = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? THREE.MathUtils.clamp(Number(new URLSearchParams(location.search).get('start')) || 0, 0, timelineLength)
  : 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090a0b);
scene.fog = new THREE.FogExp2(0x090a0b, 0.034);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 160);
camera.position.set(0, 1.62, 2.8);
camera.rotation.order = 'YXZ';

const player = new THREE.Group();
scene.add(player);
player.add(camera);
sceneHost.dataset.playerX = '0.000';
sceneHost.dataset.playerZ = '0.000';
sceneHost.dataset.phase = 'ready';
sceneHost.dataset.yaw = '0.000';
sceneHost.dataset.passed = 'false';
sceneHost.dataset.risen = 'false';
sceneHost.dataset.receded = 'false';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .76;
renderer.xr.enabled = true;
sceneHost.append(renderer.domElement);

const tunnel = new THREE.Mesh(
  new THREE.CylinderGeometry(7.5, 7.5, 150, 48, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x141617, roughness: 1, metalness: 0, side: THREE.BackSide })
);
tunnel.rotation.x = Math.PI / 2;
tunnel.position.z = -67;
scene.add(tunnel);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 150, 1, 30),
  new THREE.MeshStandardMaterial({ color: 0x0e1011, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -67);
scene.add(floor);

const ribs = new THREE.Group();
const ribMaterial = new THREE.MeshBasicMaterial({ color: 0x272a2b, transparent: true, opacity: .24 });
for (let z = 1; z > -140; z -= 4) {
  const rib = new THREE.Mesh(new THREE.TorusGeometry(7.45, .018, 4, 64), ribMaterial);
  rib.position.set(0, 1.3, z);
  rib.rotation.x = Math.PI / 2;
  ribs.add(rib);
}
scene.add(ribs);
scene.add(new THREE.HemisphereLight(0xbfc6c8, 0x08090a, .18));

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
let elapsedBeforePause = localStart;
let nextSpawnAt = 0;
let sequence = 0;
let liveMessages = [];
const movementKeys = new Set();
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const desiredVelocity = new THREE.Vector2();
const smoothVelocity = new THREE.Vector2();
const worldUp = new THREE.Vector3(0, 1, 0);
const cameraWorldPosition = new THREE.Vector3();
const headBeforeTurn = new THREE.Vector3();
const headAfterTurn = new THREE.Vector3();

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function colorForCategory(category = '') {
  const name = category.toUpperCase();
  if (name.includes('WIRTSCHAFT') || name.includes('PREIS')) return '#183A5A';
  if (name.includes('INNEN')) return '#263E63';
  if (name.includes('AUSLAND')) return '#1D4B73';
  if (name.includes('KARRIERE') || name.includes('STUDIUM')) return '#313D65';
  if (name.includes('KLIMA') || name.includes('UMWELT') || name.includes('REGION')) return '#164A59';
  if (name.includes('GESUND') || name.includes('PSYCH')) return '#343B63';
  if (name.includes('WISSEN') || name.includes('UNIVERSUM')) return '#1E405F';
  if (name.includes('NETZ') || name.includes('MEDIEN')) return '#193B50';
  if (name.includes('POLITIK')) return '#263B59';
  return '#1C2C3E';
}

function makeCardTexture(message, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorForCategory(message.category);
  roundedRect(ctx, 3, 3, 894, 294, 30);
  ctx.strokeStyle = 'rgba(186, 218, 247, .62)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(50, 45, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#8CCBFF';
  ctx.fill();
  ctx.fillStyle = '#EAF3FC';
  ctx.font = '500 24px Arial';
  ctx.letterSpacing = '3px';
  ctx.fillText(message.source, 74, 52);
  ctx.fillStyle = '#AFC7DE';
  ctx.textAlign = 'right';
  ctx.font = '500 19px Arial';
  ctx.fillText(String(index + 1).padStart(3, '0'), 856, 48);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F7FAFD';
  ctx.font = '600 47px Arial';
  const words = message.title.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = `${line}${line ? ' ' : ''}${word}`;
    if (ctx.measureText(test).width > 800 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  lines.slice(0, 2).forEach((text, i) => ctx.fillText(text, 44, 122 + i * 54));
  ctx.fillStyle = '#B8CEE2';
  ctx.font = '500 18px Arial';
  ctx.fillText(`${message.category}  ·  ${message.age}`, 44, 266);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function currentElapsed() {
  const seconds = running ? elapsedBeforePause + ((performance.now() - startedAt) / 1000) * localTempo : elapsedBeforePause;
  return Math.max(0, seconds);
}

function phaseAt(seconds = currentElapsed()) {
  return phases.find(phase => seconds >= phase.start && seconds < phase.end) || phases.at(-1);
}

function disposeCard(card) {
  const index = cards.indexOf(card);
  if (index >= 0) cards.splice(index, 1);
  card.material.map.dispose();
  card.material.dispose();
  card.geometry.dispose();
  messageGroup.remove(card);
}

function playTone(level) {
  if (!soundOn || !audio.context || level <= 0) return;
  const ctx = audio.context;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = Math.random() > .7 ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(640 + Math.random() * 620, now);
  osc.frequency.exponentialRampToValueAtTime(280 + level * 18, now + .12);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.007 + level * .004, now + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .15);
  osc.connect(gain).connect(audio.master);
  osc.start(now);
  osc.stop(now + .16);
}

function spawnCard(customMessage, close = false, quiet = false) {
  const message = customMessage || (liveMessages.length ? liveMessages[sequence % liveMessages.length] : messageAt(sequence));
  const phase = phaseAt();
  const material = new THREE.MeshBasicMaterial({
    map: makeCardTexture(message, sequence),
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(.6, .2), material);
  const side = Math.random() < .5 ? -1 : 1;
  const spread = 2.7 + phase.level * .45;
  const readable = close || Math.random() < .34;
  const surroundChance = phase.surround;
  const surroundsViewer = Math.random() < surroundChance;
  const angle = Math.random() * Math.PI * 2;
  const distance = readable ? 3.2 + Math.random() * 3.2 : surroundsViewer ? 4.8 + Math.random() * 2.2 : 7 + Math.random() * 8;
  const rawBaseX = surroundsViewer
    ? player.position.x + Math.cos(angle) * distance
    : player.position.x + side * (readable ? .45 + Math.random() * 2.5 : .7 + Math.random() * spread);
  const baseX = THREE.MathUtils.clamp(rawBaseX, -6.4, 6.4);
  const baseY = readable ? 1.05 + Math.random() * 2.3 : .65 + Math.random() * 4.4;
  const baseZ = surroundsViewer ? player.position.z + Math.sin(angle) * distance : player.position.z - distance;
  const horizontalDistance = Math.max(.001, Math.hypot(player.position.x - baseX, player.position.z - baseZ));
  const directionX = (player.position.x - baseX) / horizontalDistance;
  const directionZ = (player.position.z - baseZ) / horizontalDistance;
  const motionRoll = Math.random();
  const behavior = motionRoll < .22 ? 'rise' : motionRoll < .42 ? 'recede' : 'pass';
  card.position.set(baseX, baseY, baseZ);
  camera.getWorldPosition(cameraWorldPosition);
  card.lookAt(cameraWorldPosition);
  card.userData = {
    id: sequence,
    born: clock.elapsedTime,
    baseX,
    baseY,
    baseZ,
    behavior,
    category: message.category,
    directionX,
    directionZ,
    hold: phase.hold,
    startDistance: horizontalDistance,
    surroundsViewer,
    targetScale: readable ? 1.12 : .96,
    travel: 0,
    speed: phase.speed * (.84 + Math.random() * .32),
    waveAmplitude: .22 + Math.random() * (.42 + phase.level * .1),
    waveFrequency: .55 + Math.random() * 1.1,
    wavePhase: Math.random() * Math.PI * 2,
    url: message.url || ''
  };
  card.scale.setScalar(.04);
  messageGroup.add(card);
  cards.push(card);
  sequence += 1;
  while (cards.length > 240) disposeCard(cards[0]);
  if (!quiet) playTone(phase.level || 3);
  updateReadout();
}

function updateReadout() {
  const seconds = Math.floor(currentElapsed());
  const phase = phaseAt(seconds);
  ui.elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  ui.intensity.style.height = `${Math.max(3, phase.level / 6 * 100)}%`;
  ui.count.textContent = String(cards.length).padStart(3, '0');
  ui.phase.textContent = !running && seconds === 0 ? 'BEREIT' : !running ? 'ANGEHALTEN' : phase.label;
  sceneHost.dataset.phase = !running && seconds === 0 ? 'ready' : phase.id;
  sceneHost.dataset.behaviors = [...new Set(cards.map(card => card.userData.behavior))].join(',');
  sceneHost.dataset.categories = [...new Set(cards.map(card => card.userData.category))].join('|');
  sceneHost.dataset.surrounding = String(cards.filter(card => card.userData.surroundsViewer).length);
}

const audio = { context: null, master: null, drone: null, breath: null };
function initAudio() {
  if (audio.context) {
    audio.context.resume();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio.context = new AudioContext();
  audio.master = audio.context.createGain();
  audio.master.gain.value = soundOn ? .52 : 0;
  audio.master.connect(audio.context.destination);

  const drone = audio.context.createOscillator();
  const droneGain = audio.context.createGain();
  drone.type = 'sine';
  drone.frequency.value = 42;
  droneGain.gain.value = 0;
  drone.connect(droneGain).connect(audio.master);
  drone.start();
  audio.drone = droneGain;

  const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 5, audio.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * .55;
  const breathSource = audio.context.createBufferSource();
  const filter = audio.context.createBiquadFilter();
  const breathGain = audio.context.createGain();
  breathSource.buffer = buffer;
  breathSource.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 620;
  filter.Q.value = .7;
  breathGain.gain.value = 0;
  breathSource.connect(filter).connect(breathGain).connect(audio.master);
  breathSource.start();
  audio.breath = breathGain;
}

function start() {
  initAudio();
  if (!running) {
    startedAt = performance.now();
    running = true;
    nextSpawnAt = currentElapsed() + .3;
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
ui.add.addEventListener('click', () => {
  initAudio();
  spawnCard(null, true);
});
ui.sound.addEventListener('click', () => {
  soundOn = !soundOn;
  ui.sound.textContent = soundOn ? 'TON AN' : 'TON AUS';
  ui.sound.setAttribute('aria-pressed', String(soundOn));
  if (audio.master) audio.master.gain.setTargetAtTime(soundOn ? .52 : 0, audio.context.currentTime, .04);
});

const xrButton = VRButton.createButton(renderer);
document.body.append(xrButton);
ui.vr.addEventListener('click', () => xrButton.click());
renderer.xr.addEventListener('sessionstart', () => {
  start();
  ui.vr.textContent = 'VR AKTIV';
});
renderer.xr.addEventListener('sessionend', () => {
  ui.vr.textContent = 'VR';
});

const allowedHosts = new Set([
  'www.tagesschau.de', 'tagesschau.de', 'taz.de', 'www.taz.de', 'www.spiegel.de', 'spiegel.de',
  'www.deutschlandfunk.de', 'deutschlandfunk.de', 'www.bild.de', 'bild.de', 'ondemand-mp3.dradio.de'
]);

function openCardUrl(card) {
  if (!card?.userData.url) return;
  const url = new URL(card.userData.url);
  if (!allowedHosts.has(url.hostname)) return;
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
  yaw -= (event.clientX - pointerX) * .0024;
  pitch -= (event.clientY - pointerY) * .0024;
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
renderer.domElement.addEventListener('pointercancel', () => {
  dragging = false;
});

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
window.addEventListener('keydown', event => {
  if (!movementCodes.has(event.code)) return;
  movementKeys.add(event.code);
  if (!event.repeat && !renderer.xr.isPresenting) {
    if (event.code === 'KeyQ') yaw += .045;
    if (event.code === 'KeyE') yaw -= .045;
    const sideways = Number(event.code === 'KeyD' || event.code === 'ArrowRight') - Number(event.code === 'KeyA' || event.code === 'ArrowLeft');
    const forwards = Number(event.code === 'KeyW' || event.code === 'ArrowUp') - Number(event.code === 'KeyS' || event.code === 'ArrowDown');
    movePlayer(sideways, forwards, .06, camera);
  }
  event.preventDefault();
});
window.addEventListener('keyup', event => {
  movementKeys.delete(event.code);
});
window.addEventListener('blur', () => movementKeys.clear());

function movePlayer(sideways, forwards, speed, viewCamera) {
  if (Math.abs(sideways) < .015 && Math.abs(forwards) < .015) return;
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
  const turn = Number(movementKeys.has('KeyQ')) - Number(movementKeys.has('KeyE'));
  yaw += turn * delta * 1.35;
  desiredVelocity.set(
    Number(movementKeys.has('KeyD') || movementKeys.has('ArrowRight')) - Number(movementKeys.has('KeyA') || movementKeys.has('ArrowLeft')),
    Number(movementKeys.has('KeyW') || movementKeys.has('ArrowUp')) - Number(movementKeys.has('KeyS') || movementKeys.has('ArrowDown'))
  );
  if (desiredVelocity.lengthSq() > 1) desiredVelocity.normalize();
  const smoothing = 1 - Math.exp(-delta * 5.5);
  smoothVelocity.lerp(desiredVelocity, smoothing);
  movePlayer(smoothVelocity.x, smoothVelocity.y, delta * 2.35, camera);
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

function smoothTurn(x, xrCamera, delta) {
  if (Math.abs(x) < .12) return;
  xrCamera.getWorldPosition(headBeforeTurn);
  player.rotation.y -= x * delta * 1.35;
  player.updateMatrixWorld(true);
  xrCamera.getWorldPosition(headAfterTurn);
  player.position.add(headBeforeTurn.sub(headAfterTurn));
  player.updateMatrixWorld(true);
}

function updateXRMovement(delta) {
  const session = renderer.xr.getSession();
  if (!session) return;
  const xrCamera = renderer.xr.getCamera(camera);
  let usedMovementStick = false;
  for (const source of session.inputSources) {
    const stick = controllerStick(source.gamepad);
    if (source.handedness === 'right') {
      smoothTurn(stick.x, xrCamera, delta);
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
  getCardStates() {
    return cards.slice(0, 40).map(card => ({
      id: card.userData.id,
      behavior: card.userData.behavior,
      category: card.userData.category,
      color: card.material.map?.image ? colorForCategory(card.userData.category) : '',
      x: Number(card.position.x.toFixed(2)),
      y: Number(card.position.y.toFixed(2)),
      z: Number(card.position.z.toFixed(2))
    }));
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
  } catch {
    return;
  }
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

function alternateCategories(messages) {
  const groups = new Map();
  for (const message of messages) {
    const category = message.category || 'NACHRICHTEN';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(message);
  }
  const ordered = [];
  const queues = [...groups.values()];
  while (queues.some(queue => queue.length)) {
    for (const queue of queues) {
      const message = queue.shift();
      if (message) ordered.push(message);
    }
  }
  return ordered;
}

async function loadRssMessages() {
  for (const path of ['./feeds.json', './public/feeds.json']) {
    try {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) continue;
      const payload = await response.json();
      const messages = (payload.messages || []).filter(item => item.title && item.source);
      if (!messages.length) continue;
      liveMessages = alternateCategories(messages.map(item => ({ ...item, age: relativeAge(item.publishedAt) })));
      const updated = new Date(payload.updatedAt);
      ui.sourceStatus.textContent = `LIVE RSS · STAND ${updated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
      return;
    } catch {
      continue;
    }
  }
  ui.sourceStatus.textContent = 'DEMO-INHALTE · RSS NICHT ERREICHBAR';
}
loadRssMessages();

function updateAudio(now, phase) {
  if (!audio.context) return;
  const audioNow = audio.context.currentTime;
  const droneTarget = running && !phase.breath ? .003 + phase.level * .0022 : 0;
  audio.drone.gain.setTargetAtTime(droneTarget, audioNow, .4);
  const breathPulse = .5 + .5 * Math.sin(now * 1.55 - Math.PI / 2);
  const breathTarget = running && phase.breath ? .012 + breathPulse * .052 : 0;
  audio.breath.gain.setTargetAtTime(breathTarget, audioNow, .18);
}

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), .05);
  const now = clock.elapsedTime;
  if (!renderer.xr.isPresenting) {
    camera.rotation.set(pitch, yaw, 0);
    sceneHost.dataset.yaw = yaw.toFixed(3);
  }
  updateDesktopMovement(delta);
  updateXRMovement(delta);

  const elapsed = currentElapsed();
  const phase = phaseAt(elapsed);
  if (running && phase.batch > 0 && elapsed >= nextSpawnAt) {
    for (let i = 0; i < phase.batch; i += 1) spawnCard(null, Math.random() < .08);
    nextSpawnAt = elapsed + phase.interval;
  }
  if (running) updateReadout();

  camera.getWorldPosition(cameraWorldPosition);
  const vanish = phase.id === 'silence' ? THREE.MathUtils.clamp((elapsed - timelineLength) / .8, 0, 1) : 0;
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    const age = now - card.userData.born;
    const ease = 1 - Math.exp(-age * 7);
    const overshoot = age < .55 ? Math.sin(age / .55 * Math.PI) * .16 : 0;
    card.scale.setScalar((ease + overshoot) * card.userData.targetScale * (1 - vanish * .45));
    card.material.opacity = Math.min(1, age * 5) * (1 - vanish);
    const movingAge = Math.max(0, age - card.userData.hold);
    const waveStrength = movingAge > 0 ? 1 : .18;
    const wave = Math.sin(movingAge * card.userData.waveFrequency * 3 + card.userData.wavePhase);
    if (movingAge > 0 && card.userData.behavior === 'pass') card.userData.travel += card.userData.speed * delta;
    if (movingAge > 0 && card.userData.behavior === 'rise') {
      card.userData.travel += card.userData.speed * .12 * delta;
      card.userData.baseY += card.userData.speed * .34 * delta;
      sceneHost.dataset.risen = 'true';
    }
    if (movingAge > 0 && card.userData.behavior === 'recede') {
      card.userData.travel -= card.userData.speed * .48 * delta;
      sceneHost.dataset.receded = 'true';
    }
    const perpendicularX = -card.userData.directionZ;
    const perpendicularZ = card.userData.directionX;
    card.position.x = card.userData.baseX + card.userData.directionX * card.userData.travel + perpendicularX * wave * card.userData.waveAmplitude * waveStrength;
    card.position.y = card.userData.baseY + Math.cos(movingAge * card.userData.waveFrequency * 2 + card.userData.wavePhase) * card.userData.waveAmplitude * .22 * waveStrength;
    card.position.z = card.userData.baseZ + card.userData.directionZ * card.userData.travel + perpendicularZ * wave * card.userData.waveAmplitude * waveStrength;
    if (movingAge > 0 && card.userData.behavior === 'pass') sceneHost.dataset.passed = 'true';
    card.lookAt(cameraWorldPosition);
    const hasPassed = card.userData.behavior === 'pass' && card.userData.travel > card.userData.startDistance + 8;
    const hasRisen = card.position.y > 8.5;
    const hasReceded = card.userData.behavior === 'recede' && card.userData.travel < -52;
    if (hasPassed || hasRisen || hasReceded || vanish >= 1) disposeCard(card);
  }

  updateAudio(now, phase);
  renderer.render(scene, camera);
});
