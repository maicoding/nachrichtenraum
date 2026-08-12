const categoryColors = {
  POLITIK: "#133e75",
  INNENPOLITIK: "#173f78",
  AUSLANDSPOLITIK: "#1a3764",
  AUSLAND: "#1a3764",
  "WIRTSCHAFT & PREISE": "#0f4b6d",
  WIRTSCHAFT: "#0f4b6d",
  MIETEN: "#294a76",
  RENTE: "#3a4670",
  "GESUNDHEIT & PSYCHE": "#1b5368",
  GESUNDHEIT: "#1b5368",
  "KLIMA & UMWELT": "#18556a",
  KLIMA: "#18556a",
  STUDIUM: "#32477b",
  "KARRIERE & STUDIUM": "#2b4b73",
  KARRIERE: "#2b4b73",
  NACHRICHTEN: "#173e6d",
  NEWS: "#173e6d",
};

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

function pulse(cursorEl, strength = 0.35, duration = 55) {
  const gamepad =
    cursorEl?.components?.["tracked-controls"]?.controller?.gamepad ||
    cursorEl?.components?.["meta-touch-controls"]?.controller?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator;
  if (actuator?.pulse) actuator.pulse(strength, duration).catch(() => {});
  else if (actuator?.playEffect) actuator.playEffect("dual-rumble", { duration, strongMagnitude: strength, weakMagnitude: strength });
}

export function isCloseHit(uv) {
  return Boolean(uv && uv.x > 0.8 && uv.y > 0.7);
}

export class CardPool {
  constructor({ THREE, root, max = 72, onToggle, onClose }) {
    this.THREE = THREE;
    this.root = root;
    this.max = max;
    this.onToggle = onToggle;
    this.onClose = onClose;
    this.slots = [];
    this.active = new Set();
    this.geometry = new THREE.PlaneGeometry(1.46, 0.73);
    this.cameraPosition = new THREE.Vector3();
    this.tempPosition = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
  }

  createSlot() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext("2d", { alpha: false });
    const texture = new this.THREE.CanvasTexture(canvas);
    texture.colorSpace = this.THREE.SRGBColorSpace;
    texture.minFilter = this.THREE.LinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new this.THREE.MeshBasicMaterial({
      map: texture,
      side: this.THREE.FrontSide,
      toneMapped: false,
    });
    const mesh = new this.THREE.Mesh(this.geometry, material);
    const entity = document.createElement("a-entity");
    entity.classList.add("news-card");
    entity.setObject3D("mesh", mesh);
    entity.object3D.visible = false;
    this.root.appendChild(entity);
    const slot = {
      entity,
      mesh,
      material,
      texture,
      canvas,
      context,
      active: false,
      paused: false,
      hoveredBy: new Set(),
      velocity: new this.THREE.Vector3(),
      pitch: 1,
      wave: 0,
      bornAt: 0,
      message: null,
      raycast: mesh.raycast,
    };
    mesh.userData.slot = slot;
    entity.addEventListener("click", (event) => this.handleClick(slot, event));
    entity.addEventListener("raycaster-intersected", (event) => {
      slot.hoveredBy.add(event.detail.el);
      this.refreshColor(slot);
      slot.entity.object3D.scale.setScalar((slot.baseScale || 1) * 1.035);
    });
    entity.addEventListener("raycaster-intersected-cleared", (event) => {
      slot.hoveredBy.delete(event.detail.el);
      if (!slot.hoveredBy.size) slot.entity.object3D.scale.setScalar(slot.baseScale || 1);
      this.refreshColor(slot);
    });
    this.slots.push(slot);
    return slot;
  }

  handleClick(slot, event) {
    if (!slot.active) return;
    event.stopPropagation();
    const uv = event.detail?.intersection?.uv;
    if (uv) this.root.dataset.lastUv = `${uv.x.toFixed(3)},${uv.y.toFixed(3)}`;
    const closes = isCloseHit(uv);
    pulse(event.detail?.cursorEl, closes ? 0.65 : 0.32, 65);
    if (closes) {
      this.onClose(slot);
      return;
    }
    this.onToggle(slot);
  }

  draw(slot, message) {
    const { context } = slot;
    const accent = categoryColors[message.category] || categoryColors.NEWS;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 512, 256);
    context.fillStyle = accent;
    context.fillRect(0, 0, 14, 256);
    context.fillRect(14, 0, 498, 13);
    context.fillStyle = "#080d17";
    context.fillRect(449, 18, 46, 46);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(462, 31);
    context.lineTo(482, 51);
    context.moveTo(482, 31);
    context.lineTo(462, 51);
    context.stroke();
    context.fillStyle = "#1a3156";
    context.font = "700 14px Arial";
    context.fillText(`${message.source} · ${message.category}`, 34, 47);
    context.fillStyle = "#070a0f";
    context.font = "700 27px Arial";
    const titleLines = wrapText(context, message.title, 398, 3);
    titleLines.forEach((line, index) => context.fillText(line, 34, 87 + index * 30));
    context.fillStyle = "#333946";
    context.font = "400 16px Arial";
    const excerptLines = wrapText(context, message.excerpt, 440, 2);
    const excerptY = 103 + titleLines.length * 30;
    excerptLines.forEach((line, index) => context.fillText(line, 34, excerptY + index * 21));
    context.fillStyle = accent;
    context.fillRect(34, 232, 108, 5);
    slot.texture.needsUpdate = true;
  }

  randomPosition(cameraPosition) {
    const radius = this.THREE.MathUtils.lerp(2.25, 5.6, Math.pow(Math.random(), 0.78));
    const theta = Math.random() * Math.PI * 2;
    const vertical = this.THREE.MathUtils.lerp(-0.72, 0.78, Math.random());
    const planar = Math.sqrt(1 - vertical * vertical);
    return new this.THREE.Vector3(
      cameraPosition.x + Math.cos(theta) * planar * radius,
      cameraPosition.y + vertical * radius * 0.52,
      cameraPosition.z + Math.sin(theta) * planar * radius,
    );
  }

  acquire(message, cameraPosition, now = performance.now()) {
    let slot = this.slots.find((candidate) => !candidate.active);
    if (!slot && this.slots.length < this.max) slot = this.createSlot();
    if (!slot) return null;
    slot.active = true;
    slot.paused = false;
    slot.message = message;
    slot.pitch = this.THREE.MathUtils.randFloat(0.72, 1.62);
    slot.wave = Math.random() * Math.PI * 2;
    slot.bornAt = now;
    slot.hoveredBy.clear();
    this.draw(slot, message);
    const position = this.randomPosition(cameraPosition);
    slot.entity.object3D.position.copy(position);
    slot.entity.object3D.lookAt(cameraPosition);
    slot.entity.object3D.rotateZ(this.THREE.MathUtils.randFloatSpread(0.12));
    slot.baseScale = this.THREE.MathUtils.randFloat(0.92, 1.08);
    slot.entity.object3D.scale.setScalar(slot.baseScale);
    const radial = position.clone().sub(cameraPosition).normalize();
    slot.velocity.set(-radial.z, this.THREE.MathUtils.randFloatSpread(0.24), radial.x).normalize();
    slot.velocity.multiplyScalar(this.THREE.MathUtils.randFloat(0.035, 0.1));
    slot.entity.object3D.visible = true;
    slot.mesh.raycast = slot.raycast;
    slot.entity.classList.add("interactive");
    slot.entity.dataset.active = "true";
    slot.entity.dataset.paused = "false";
    this.active.add(slot);
    this.refreshColor(slot);
    return slot;
  }

  release(slot) {
    if (!slot?.active) return;
    slot.active = false;
    slot.paused = false;
    slot.hoveredBy.clear();
    slot.entity.object3D.visible = false;
    slot.entity.object3D.scale.setScalar(1);
    slot.mesh.raycast = () => {};
    slot.entity.classList.remove("interactive");
    slot.entity.dataset.active = "false";
    slot.entity.dataset.paused = "false";
    this.active.delete(slot);
  }

  releaseAll() {
    for (const slot of [...this.active]) this.release(slot);
  }

  prepareReplacement(closedSlot, extraCount) {
    let remaining = Math.max(0, extraCount);
    const candidates = [...this.active].filter(
      (candidate) => !candidate.paused && !candidate.hoveredBy.size,
    );
    const fallback = [...this.active].filter((candidate) => !candidate.hoveredBy.size);
    while (remaining > 0) {
      const slot = candidates.shift() || fallback.shift();
      if (!slot) break;
      if (slot !== closedSlot && slot.active) {
        this.release(slot);
        remaining -= 1;
      }
    }
  }

  makeSpace(count) {
    while (this.size > this.max - count) {
      const candidates = [...this.active];
      const slot =
        candidates.find((candidate) => !candidate.paused && !candidate.hoveredBy.size) ||
        candidates.find((candidate) => !candidate.hoveredBy.size) ||
        candidates[0];
      if (!slot) break;
      this.release(slot);
    }
  }

  toggle(slot) {
    if (!slot?.active) return false;
    slot.paused = !slot.paused;
    slot.entity.dataset.paused = String(slot.paused);
    this.refreshColor(slot);
    return slot.paused;
  }

  refreshColor(slot) {
    if (!slot.active) return;
    if (slot.hoveredBy.size) slot.material.color.set(0xc9e0ff);
    else if (slot.paused) slot.material.color.set(0x7fa6e8);
    else slot.material.color.set(0xffffff);
  }

  update(delta, intensity, now, cameraPosition) {
    let index = 0;
    for (const slot of this.active) {
      if (!slot.paused) {
        const age = (now - slot.bornAt) / 1000;
        slot.entity.object3D.position.addScaledVector(slot.velocity, delta * intensity);
        slot.entity.object3D.position.y += Math.sin(age * 1.15 + slot.wave) * 0.0014 * intensity;
        if (index % 5 === Math.floor(now / 220) % 5) {
          slot.entity.object3D.lookAt(cameraPosition);
          slot.entity.object3D.rotateZ(Math.sin(slot.wave + age * 0.16) * 0.035);
        }
        const distance = slot.entity.object3D.position.distanceTo(cameraPosition);
        if (distance > 7.2 || distance < 1.35) {
          slot.entity.object3D.position.copy(this.randomPosition(cameraPosition));
          slot.entity.object3D.lookAt(cameraPosition);
        }
      }
      index += 1;
    }
  }

  get size() {
    return this.active.size;
  }

  get pausedCount() {
    let count = 0;
    for (const slot of this.active) if (slot.paused) count += 1;
    return count;
  }
}
