/*
 * EUROPACK – Münzen in 3D, im Code erzeugt.
 *
 * Jede Münze ist eine echte Scheibe mit Dicke und Rand, per Raytracing im
 * Fragment-Shader gerendert. Metall, Rand und Rückseite kommen aus dem Code;
 * das Foto der Nationalseite liefert nur das Relief (Helligkeitsunterschiede
 * werden zu Erhebungen) und etwas Patina. Ein einziger, versteckter
 * WebGL-Kontext rendert für alle Münzen der Seite und kopiert das Ergebnis
 * in deren 2D-Canvas – so gehen auch 200 Münzen im Album.
 *
 * Verwendung: <canvas class="coin3d" data-src="…" data-cents="200"
 *   data-mode="static|spin|wobble|tilt"> – wird automatisch gefunden.
 * Ohne WebGL oder wenn das Bild nicht lädt, bleibt der gezeichnete
 * Platzhalter im umgebenden .coin sichtbar.
 */
(function () {
  'use strict';

  const VERT = `
attribute vec2 aPos;
varying vec2 vP;
void main() { vP = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
varying vec2 vP;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform mat3 uRot;      // Objekt -> Welt
uniform float uThick;   // halbe Dicke
uniform float uCore;    // Radius des Kerns bei Bimetall
uniform float uReed;    // Anzahl Riffel am Rand (0 = glatt)
uniform float uRelief;  // Stärke des Reliefs
uniform float uTime;
uniform int uAlloy;     // 0 Kupfer, 1 Nordisches Gold, 2 1 €, 3 2 €
uniform vec3 uLight;

const vec3 COPPER = vec3(0.80, 0.46, 0.30);
const vec3 GOLD = vec3(0.88, 0.72, 0.40);
const vec3 SILVER = vec3(0.80, 0.81, 0.84);

vec3 metal(float r) {
  if (uAlloy == 0) return COPPER;
  if (uAlloy == 1) return GOLD;
  bool core = r < uCore;
  if (uAlloy == 2) return core ? SILVER : GOLD;   // 1 €: Kern silbern, Ring golden
  return core ? GOLD : SILVER;                    // 2 €: Kern golden, Ring silbern
}

float lum(sampler2D t, vec2 uv, float bias) {
  return dot(texture2D(t, uv, bias).rgb, vec3(0.299, 0.587, 0.114));
}

// Relief: Hochpass der Helligkeit (Detail minus unscharfe Version)
float height(sampler2D t, vec2 uv) {
  return lum(t, uv, 0.6) - lum(t, uv, 3.5);
}

vec3 env(vec3 r) {
  // Studio-Licht: dunkler Raum, heller Himmel, zwei Softboxen
  vec3 c = mix(vec3(0.14, 0.15, 0.19), vec3(0.72, 0.74, 0.80), smoothstep(-0.3, 0.8, r.y));
  c += vec3(1.3) * pow(max(dot(r, normalize(vec3(-0.5, 0.55, 0.65))), 0.0), 20.0);
  c += vec3(0.8, 0.83, 0.95) * pow(max(dot(r, normalize(vec3(0.7, -0.2, 0.7))), 0.0), 14.0);
  c += vec3(0.18) * pow(max(dot(r, vec3(0.0, 0.0, 1.0)), 0.0), 6.0);   // Frontlicht
  return c;
}

void main() {
  vec3 ro = vec3(vP * 1.12, 4.0);
  vec3 rd = vec3(0.0, 0.0, -1.0);
  mat3 inv = mat3(uRot[0][0], uRot[1][0], uRot[2][0],
                  uRot[0][1], uRot[1][1], uRot[2][1],
                  uRot[0][2], uRot[1][2], uRot[2][2]);
  vec3 o = inv * ro;
  vec3 d = inv * rd;

  float tBest = 1e9;
  int part = -1; // 0 Vorderseite, 1 Rückseite, 2 Rand
  if (abs(d.z) > 1e-5) {
    float t1 = (uThick - o.z) / d.z;
    vec3 p1 = o + d * t1;
    if (t1 > 0.0 && dot(p1.xy, p1.xy) <= 1.0 && t1 < tBest) { tBest = t1; part = 0; }
    float t2 = (-uThick - o.z) / d.z;
    vec3 p2 = o + d * t2;
    if (t2 > 0.0 && dot(p2.xy, p2.xy) <= 1.0 && t2 < tBest) { tBest = t2; part = 1; }
  }
  float a = dot(d.xy, d.xy);
  if (a > 1e-6) {
    float b = 2.0 * dot(o.xy, d.xy);
    float c = dot(o.xy, o.xy) - 1.0;
    float disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      float t3 = (-b - sqrt(disc)) / (2.0 * a);
      vec3 p3 = o + d * t3;
      if (t3 > 0.0 && abs(p3.z) <= uThick && t3 < tBest) { tBest = t3; part = 2; }
    }
  }
  if (part < 0) { gl_FragColor = vec4(0.0); return; }

  vec3 p = o + d * tBest;
  float r = length(p.xy);
  vec3 n;
  vec3 albedo;
  float patina = 1.0;

  if (part == 2) {
    float ang = atan(p.y, p.x);
    n = vec3(p.xy / max(r, 1e-4), 0.0);
    vec3 tang = vec3(-n.y, n.x, 0.0);
    if (uReed > 0.0) n = normalize(n + tang * 0.45 * sin(ang * uReed));
    albedo = metal(1.0) * 0.9;
  } else {
    bool front = part == 0;
    // Rückseite gespiegelt, damit Schrift von hinten richtig herum steht
    vec2 uv = vec2((front ? p.x : -p.x) * 0.5 + 0.5, 0.5 - p.y * 0.5);
    float e = 1.0 / 256.0;
    vec2 g;
    if (front) {
      g = vec2(height(uFront, uv + vec2(e, 0.0)) - height(uFront, uv - vec2(e, 0.0)),
               height(uFront, uv - vec2(0.0, e)) - height(uFront, uv + vec2(0.0, e)));
      patina = 0.66 + 0.6 * lum(uFront, uv, 0.5);
    } else {
      g = vec2(lum(uBack, uv + vec2(e, 0.0), 0.0) - lum(uBack, uv - vec2(e, 0.0), 0.0),
               lum(uBack, uv - vec2(0.0, e), 0.0) - lum(uBack, uv + vec2(0.0, e), 0.0));
      patina = 0.72 + 0.4 * lum(uBack, uv, 0.0);
      g *= 0.6;
    }
    if (!front) g.x = -g.x;
    vec3 nl = normalize(vec3(-g * uRelief, 1.0));
    // erhabener Randwulst
    float bevel = smoothstep(0.90, 1.0, r);
    nl.xy += (p.xy / max(r, 1e-4)) * bevel * 0.9 * (front ? 1.0 : 1.0);
    // Rille zwischen Kern und Ring bei Bimetall
    if (uAlloy >= 2) nl.xy -= (p.xy / max(r, 1e-4)) * 0.6 * exp(-pow((r - uCore) / 0.012, 2.0));
    nl = normalize(nl);
    n = front ? nl : vec3(nl.x, nl.y, -nl.z);
    albedo = metal(r);
  }

  vec3 nw = normalize(uRot * n);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 l = normalize(uLight);
  float diff = max(dot(nw, l), 0.0);
  vec3 rr = reflect(-v, nw);
  float fres = pow(1.0 - max(dot(nw, v), 0.0), 3.0);
  vec3 col = albedo * patina * (0.28 + 0.52 * diff)
           + albedo * patina * env(rr) * 0.72
           + mix(albedo, vec3(1.0), 0.5) * pow(max(dot(rr, l), 0.0), 60.0) * 1.3
           + fres * vec3(0.25);
  col = col / (col + vec3(0.8)) * 1.65;           // weiche Tonkurve
  // Sättigung leicht anheben, damit Kupfer und Gold nicht ausbleichen
  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, 1.15);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  // -------------------------------------------------------------------------
  // WebGL einrichten
  // -------------------------------------------------------------------------
  const glCanvas = document.createElement('canvas');
  let gl = null;
  let prog = null;
  const U = {};
  try {
    gl = glCanvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  } catch (e) { gl = null; }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  if (gl) {
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uFront', 'uBack', 'uRot', 'uThick', 'uCore', 'uReed', 'uRelief', 'uTime', 'uAlloy', 'uLight']
        .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(U.uFront, 0);
      gl.uniform1i(U.uBack, 1);
    } catch (e) {
      console.warn('Coin3D: Shader nicht verfügbar', e);
      gl = null;
    }
  }

  // -------------------------------------------------------------------------
  // Texturen: Fotos der Nationalseiten (LRU-Cache) und erzeugte Rückseiten
  // -------------------------------------------------------------------------
  const MAX_TEX = 48;
  const textures = new Map(); // key -> { tex, ready: Promise }

  function makeTexture(source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function touch(key, entry) {
    textures.delete(key);
    textures.set(key, entry);
    while (textures.size > MAX_TEX) {
      const [oldKey, old] = textures.entries().next().value;
      if (old.tex && !old.keep) gl.deleteTexture(old.tex);
      textures.delete(oldKey);
    }
  }

  function photoTexture(src) {
    const hit = textures.get(src);
    if (hit) { touch(src, hit); return hit.ready; }
    const entry = { tex: null };
    entry.ready = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          // Auf 256 × 256 bringen (Zweierpotenz für Mipmaps)
          const c = document.createElement('canvas');
          c.width = c.height = 256;
          c.getContext('2d').drawImage(img, 0, 0, 256, 256);
          entry.tex = makeTexture(c);
          resolve(entry.tex);
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('Bild fehlt: ' + src));
      img.src = src;
    });
    entry.ready.catch(() => textures.delete(src));
    touch(src, entry);
    return entry.ready;
  }

  // Gemeinschaftsseite, im Code gezeichnet: Wert, „EURO“/„EURO CENT“,
  // zwölf Sterne und die Linien, die sie mit dem Rand verbinden.
  function backTexture(cents) {
    const key = 'back:' + cents;
    const hit = textures.get(key);
    if (hit) return hit.ready;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#5a5a5a';
    g.fillRect(0, 0, 256, 256);
    g.translate(128, 128);
    g.strokeStyle = '#d8d8d8';
    g.fillStyle = '#ececec';
    // Linien von links oben nach rechts unten, wie auf den echten Münzen
    g.lineWidth = 1.4;
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(-120, i * 16 - 40);
      g.lineTo(120, i * 16 + 40);
      g.globalAlpha = 0.35;
      g.stroke();
    }
    g.globalAlpha = 1;
    // Sterne im Kreis
    const star = (x, y, s) => {
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 ? s * 0.42 : s;
        const a = -Math.PI / 2 + k * Math.PI / 5;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    };
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      star(Math.cos(a) * 100, Math.sin(a) * 100, 7);
    }
    // Wert und Einheit
    const big = cents >= 100 ? String(cents / 100) : String(cents);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${big.length > 1 ? 92 : 112}px "Space Grotesk", system-ui, sans-serif`;
    g.fillText(big, 18, -8);
    g.font = '700 22px "Space Grotesk", system-ui, sans-serif';
    g.fillText(cents >= 100 ? 'EURO' : 'EURO CENT', 18, 58);
    const entry = { tex: makeTexture(c), keep: true };
    entry.ready = Promise.resolve(entry.tex);
    textures.set(key, entry);
    return entry.ready;
  }

  // -------------------------------------------------------------------------
  // Rendern
  // -------------------------------------------------------------------------
  function alloyOf(cents) {
    if (cents <= 5) return 0;
    if (cents <= 50) return 1;
    return cents === 100 ? 2 : 3;
  }
  const REEDS = { 10: 140, 50: 140, 200: 180 }; // geriffelte Ränder

  // 3×3-Matrizen zeilenweise; R = Ry · Rx · Rz, für WebGL spaltenweise ausgegeben
  function mul(a, b) {
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
    return o;
  }
  function rotation(rx, ry, rz) {
    const c = Math.cos, s = Math.sin;
    const X = [1, 0, 0, 0, c(rx), -s(rx), 0, s(rx), c(rx)];
    const Y = [c(ry), 0, s(ry), 0, 1, 0, -s(ry), 0, c(ry)];
    const Z = [c(rz), -s(rz), 0, s(rz), c(rz), 0, 0, 0, 1];
    const m = mul(mul(Y, X), Z);
    return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  }

  function draw(canvas, spec, pose, front, back) {
    const css = canvas.clientWidth || canvas.width || 96;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(16, Math.min(1024, Math.round(css * dpr)));
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    const ss = Math.min(1024, size * 2); // doppelt rendern, weich verkleinern
    if (glCanvas.width !== ss) { glCanvas.width = ss; glCanvas.height = ss; }
    gl.viewport(0, 0, ss, ss);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, front);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, back);
    gl.uniformMatrix3fv(U.uRot, false, rotation(pose.rx, pose.ry, pose.rz || 0));
    const cents = spec.cents;
    gl.uniform1f(U.uThick, cents >= 100 ? 0.085 : 0.07);
    gl.uniform1f(U.uCore, cents === 100 ? 0.70 : 0.73);
    gl.uniform1f(U.uReed, REEDS[cents] || 0);
    gl.uniform1f(U.uRelief, size > 200 ? 5.0 : 4.0);
    gl.uniform1f(U.uTime, pose.t || 0);
    gl.uniform1i(U.uAlloy, alloyOf(cents));
    gl.uniform3f(U.uLight, pose.lx != null ? pose.lx : -0.45, pose.ly != null ? pose.ly : 0.55, 0.75);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(glCanvas, 0, 0, size, size);
  }

  // -------------------------------------------------------------------------
  // Posen und Animation
  // -------------------------------------------------------------------------
  const reduceMotion = () => document.body.classList.contains('reduce-motion');
  const STATIC_POSE = { rx: 0.42, ry: -0.38, lx: -0.5, ly: 0.6 };
  const live = new Set();

  // Drehung von Hand: Schwung nach dem Loslassen, dann auf die nähere Seite einrasten
  // Zeitbasiert (f = Anzahl 60-Hz-Frames seit dem letzten Aufruf), damit
  // Schwung und Einrasten auf langsamen Geräten genauso lange dauern.
  function userSpin(st) {
    const now = performance.now();
    const f = Math.min(6, Math.max(0, (now - (st.lastSpin || now)) / (1000 / 60)));
    st.lastSpin = now;
    if (!st.dragging && st.v) {
      st.spin = (st.spin || 0) + st.v * f;
      st.v *= Math.pow(0.94, f);
      if (Math.abs(st.v) < 0.004) { st.v = 0; st.snap = true; }
    }
    if (!st.dragging && st.snap) {
      const target = Math.round((st.spin || 0) / Math.PI) * Math.PI;
      st.spin += (target - st.spin) * (1 - Math.pow(1 - 0.16, f));
      if (Math.abs(target - st.spin) < 0.002) { st.spin = target; st.snap = false; }
    }
    return st.spin || 0;
  }
  const settled = (st) => !st.dragging && !st.v && !st.snap;
  // Unbewegte Münzen werden einmal gerendert und nicht animiert
  const still = (c) => c.dataset.mode === 'static' || c.dataset.mode === 'flat';

  // Münzwurf beim Öffnen: von unten hereingeworfen, landet auf der Zahl
  // (für alle Länder gleich), bleibt kurz liegen und dreht sich dann auf die
  // Bildseite. Zeiten in Sekunden; „fast“ für die normalen Slots.
  const TOSS = {
    full: { fly: 1.25, bounce: 0.18, rest: 1.0, turn: 0.75, flips: 4 },
    fast: { fly: 0.6, bounce: 0.1, rest: 0.3, turn: 0.4, flips: 2 },
  };
  function tossTiming(kind) {
    const T = TOSS[kind] || TOSS.fast;
    return { land: T.fly + T.bounce, turn: T.fly + T.bounce + T.rest, end: T.fly + T.bounce + T.rest + T.turn };
  }
  const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

  function tossPose(canvas, t) {
    const T = TOSS[canvas.dataset.toss] || TOSS.fast;
    const size = canvas.clientWidth || 200;
    const below = Math.max(window.innerHeight * 0.75, size * 3);   // Start unterhalb des Bildschirms
    let rx = Math.PI, ry = 0, rz = Math.PI, y = 0, sc = 1;
    if (t < T.fly) {
      // Flugbahn: von unten hoch über die Mitte, dann herab
      const k = t / T.fly;
      y = below * (1 - k) * (1 - k) - size * 1.1 * 4 * k * (1 - k);
      sc = 1 + 0.3 * Math.sin(Math.PI * k);
      // Salti um die waagrechte Achse, die zum Ende hin auslaufen
      rx = Math.PI + (1 - ease(k)) * Math.PI * 2 * T.flips;
    } else if (t < T.fly + T.bounce) {
      const k = (t - T.fly) / T.bounce;
      y = -size * 0.06 * Math.sin(Math.PI * k);
      rx = Math.PI - 0.12 * Math.sin(Math.PI * k);
    } else if (t < T.fly + T.bounce + T.rest) {
      // liegt auf der Zahl; Rx(π)·Rz(π) entspricht Ry(π), also lesbar
      rx = Math.PI;
    } else {
      // umdrehen zur Seite, mit leichtem Anheben
      const k = Math.min(1, (t - T.fly - T.bounce - T.rest) / T.turn);
      rx = -0.25 * Math.sin(Math.PI * k);
      rz = 0;
      ry = Math.PI * (1 - ease(k));
      y = -size * 0.08 * Math.sin(Math.PI * k);
      sc = 1 + 0.06 * Math.sin(Math.PI * k);
      if (k >= 1) {
        // danach sanftes Wiegen wie im Tausch
        const w = t - T.fly - T.bounce - T.rest - T.turn;
        rx = 0.18 * Math.sin(w * 0.9);
        ry = 0.25 * Math.sin(w * 0.6);
      }
    }
    canvas.style.transform = `translateY(${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    return { rx, ry, rz, t, lx: -0.45 + 0.25 * Math.sin(t * 0.7), ly: 0.55 };
  }

  function pose(canvas, now) {
    const st = canvas._coin;
    const t = (now - st.start) / 1000;
    const mode = canvas.dataset.mode;
    if (mode === 'toss' && !reduceMotion()) return tossPose(canvas, t);
    const spin = userSpin(st);
    // flat: gerade von vorn auf die Bildseite, unbewegt (Album)
    if (mode === 'flat') return { rx: 0, ry: st.flip ? Math.PI : 0, lx: -0.35, ly: 0.6 };
    if (mode === 'static' || reduceMotion()) {
      return Object.assign({}, STATIC_POSE, { ry: STATIC_POSE.ry + (st.flip ? Math.PI : 0) + spin });
    }
    let rx = 0.25 * Math.sin(t * 0.9);
    let ry = 0.35 * Math.sin(t * 0.6);
    if (mode === 'spin') {
      // Einwurf: schnelle Drehung, die ausläuft
      const k = Math.min(1, t / 1.5);
      const ease = 1 - Math.pow(1 - k, 3);
      ry += (1 - ease) * Math.PI * 6;
      rx += (1 - ease) * 0.5;
    }
    if (mode === 'tilt') {
      // folgt Finger oder Neigung, gedämpft
      st.tx = (st.tx || 0) + ((st.targetX || 0) - (st.tx || 0)) * 0.12;
      st.ty = (st.ty || 0) + ((st.targetY || 0) - (st.ty || 0)) * 0.12;
      rx = st.tx + 0.06 * Math.sin(t * 0.8);
      ry = st.ty + 0.08 * Math.sin(t * 0.6);
    }
    st.flipAngle = (st.flipAngle || 0) + ((st.flip ? Math.PI : 0) - (st.flipAngle || 0)) * 0.14;
    ry += st.flipAngle + spin;
    return { rx, ry, t, lx: -0.45 + 0.25 * Math.sin(t * 0.5), ly: 0.55 };
  }

  let raf = 0;
  function loop(now) {
    raf = 0;
    for (const canvas of live) {
      if (!canvas.isConnected) { live.delete(canvas); continue; }
      const st = canvas._coin;
      if (st.front && st.back) draw(canvas, st.spec, pose(canvas, now), st.front, st.back);
      // Ruhende Album-Münzen verlassen die Animation wieder
      if (still(canvas) && settled(st)) live.delete(canvas);
    }
    if (live.size && (!reduceMotion() || [...live].some((c) => !settled(c._coin)))) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && live.size) raf = requestAnimationFrame(loop); }

  function setup(canvas) {
    if (canvas._coin) return;
    const spec = { src: canvas.dataset.src, cents: Number(canvas.dataset.cents) };
    const st = { spec, start: performance.now() };
    canvas._coin = st;
    if (!gl || !spec.src) { canvas.remove(); return; }
    Promise.all([photoTexture(spec.src), backTexture(spec.cents)]).then(([front, back]) => {
      st.front = front;
      st.back = back;
      st.start = performance.now();
      canvas.parentNode && canvas.parentNode.classList.add('coin3d-on');
      if (canvas.dataset.drag) enableDrag(canvas);
      if (still(canvas)) draw(canvas, spec, pose(canvas, performance.now()), front, back);
      else { live.add(canvas); kick(); }
    }).catch(() => {
      // Platzhalter bleibt sichtbar
      if (canvas.parentNode) canvas.parentNode.classList.remove('coin-toss');
      canvas.remove();
    });
  }

  // Ziehen dreht die Münze um die senkrechte Achse, volle 360°.
  // Senkrechtes Wischen bleibt Scrollen (touch-action: pan-y), ein Tippen
  // ohne Ziehen bleibt ein normaler Klick.
  function enableDrag(canvas) {
    const host = canvas.parentNode;
    const st = canvas._coin;
    if (!host || host._drag) return;
    host._drag = true;
    host.classList.add('coin3d-drag');
    let x0 = null, lastX = 0, lastT = 0, moved = false;
    host.addEventListener('pointerdown', (e) => {
      x0 = lastX = e.clientX; lastT = e.timeStamp; moved = false;
      st.dragging = true; st.v = 0; st.snap = false;
      live.add(canvas); kick();
    });
    host.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      if (!moved && Math.abs(e.clientX - x0) > 6) {
        moved = true;
        try { host.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      }
      const k = (Math.PI * 2) / Math.max(120, host.clientWidth * 2.4);  // eine Umdrehung ≈ 2,4 Münzbreiten
      const dx = e.clientX - lastX;
      st.spin = (st.spin || 0) + dx * k;
      st.v = (dx * k) / Math.max(1, e.timeStamp - lastT) * 16;
      lastX = e.clientX; lastT = e.timeStamp;
      kick();
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null; st.dragging = false;
      if (!st.v) st.snap = true;
      kick();
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('lostpointercapture', end);
    // Nach dem Drehen kein Klick (sonst öffnet sich die Einzelansicht)
    host.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } });
  }

  // Statische Münzen erst rendern, wenn sie ins Bild kommen
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { io.unobserve(e.target); setup(e.target); }
      }
    }, { rootMargin: '200px' })
    : null;

  function scan(root) {
    const list = root.matches && root.matches('canvas.coin3d') ? [root] : root.querySelectorAll ? root.querySelectorAll('canvas.coin3d') : [];
    for (const c of list) {
      if (c._coin || c._observed) continue;
      if (still(c) && io) { c._observed = true; io.observe(c); } else setup(c);
    }
  }

  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document));

  window.Coin3D = {
    supported: !!gl,
    // Zeitpunkte des Münzwurfs in ms: gelandet (Zahl), Umdrehen beginnt, fertig
    tossTiming(kind) {
      const r = tossTiming(kind);
      return { land: r.land * 1000, turn: r.turn * 1000, end: r.end * 1000 };
    },
    // Ziel für Neigung (Bogenmaß) und Wenden setzen
    tilt(canvas, x, y) { if (canvas && canvas._coin) { canvas._coin.targetX = x; canvas._coin.targetY = y; kick(); } },
    flip(canvas) {
      if (!canvas || !canvas._coin) return;
      canvas._coin.flip = !canvas._coin.flip;
      if (still(canvas) && canvas._coin.front) draw(canvas, canvas._coin.spec, pose(canvas, performance.now()), canvas._coin.front, canvas._coin.back);
      kick();
    },
  };
})();
