// The 3D Pipes screensaver: shiny pipes growing on a 3D grid, several at once, with ball joints at some of
// the turns, a new camera angle and a checkerboard dissolve between rounds. Three.js loads only when it starts.
// The growing and dissolving follow 1j01/pipes (MIT), a remake of the original.

import { own } from './own.js';
import { el } from './util.js';

const THREE_URL = new URL('lib/three.min.js', import.meta.url).href;
const GRID = 7;
const PIPE_RADIUS = 0.2;
const BALL_RADIUS = PIPE_RADIUS * 1.5;
const CAMERA_DISTANCE = 24;
/** The original's colours: saturated and bright, a different one per pipe */
const COLORS = [0xe02020, 0x20c020, 0x2050e0, 0xe0c020, 0x20c0c0, 0xc020c0, 0xe07010, 0xc8c8c8, 0x7040e0, 0x60e040];
const DIRECTIONS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

let threeLoading = null;

function loadThree() {
    if (globalThis.THREE) {
        return Promise.resolve();
    }
    threeLoading ??= new Promise((resolve, reject) => {
        const script = /** @type {HTMLScriptElement} */ (el('script'));
        script.src = THREE_URL;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(own(script));
    });
    return threeLoading;
}

const randomOf = list => list[Math.floor(Math.random() * list.length)];
const chance = value => Math.random() < value;

/**
 * Starts the pipes on a full-window canvas.
 * @returns {Promise<() => void>} Stops them and cleans everything up.
 */
export async function runPipes() {
    await loadThree();
    const { THREE } = /** @type {any} */ (globalThis);

    const holder = el('div');
    holder.id = 'ym-pipes';
    const glCanvas = /** @type {HTMLCanvasElement} */ (el('canvas'));
    const veil = /** @type {HTMLCanvasElement} */ (el('canvas'));
    holder.append(glCanvas, veil);
    document.body.append(own(holder));
    const ctx = veil.getContext('2d');

    const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
    renderer.setClearColor(0x000000);
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
    const scene = new THREE.Scene();
    // the lights travel with the camera, so every view is as well lit as the original's
    scene.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(-0.8, 1, 1.2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(1, -0.5, 0.6);
    camera.add(light, light.target, fill, fill.target);
    light.target.position.set(0, 0, 0);
    fill.target.position.set(0, 0, 0);
    scene.add(camera);

    const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        veil.width = window.innerWidth;
        veil.height = window.innerHeight;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    // shared shapes: a run of pipe is one grid step, whichever way it faces
    const pipeShape = new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1, 16, 1, true);
    const ballShape = new THREE.SphereGeometry(BALL_RADIUS, 20, 16);
    const elbowShape = new THREE.SphereGeometry(PIPE_RADIUS, 16, 12);
    const up = new THREE.Vector3(0, 1, 0);

    let filled = new Set();
    let pipes = [];
    let group = new THREE.Group();
    let ballChance = 0;
    scene.add(group);

    const key = p => p.join();
    const inside = p => p.every(v => Math.abs(v) <= GRID);

    const addPipe = () => {
        for (let i = 0; i < 30; i++) {
            const at = [0, 1, 2].map(() => Math.floor(Math.random() * (GRID * 2 + 1)) - GRID);
            if (!filled.has(key(at))) {
                const color = new THREE.Color(randomOf(COLORS));
                const material = new THREE.MeshPhongMaterial({ color, specular: 0x99aaaa, emissive: color.clone().multiplyScalar(0.12), shininess: 40 });
                const pipe = { at, dir: null, material, stuck: false };
                filled.add(key(at));
                addBall(pipe, at);
                pipes.push(pipe);
                return;
            }
        }
    };
    const addMesh = (shape, material, position) => {
        const mesh = new THREE.Mesh(shape, material);
        mesh.position.set(...position);
        group.add(mesh);
        return mesh;
    };
    const addBall = (pipe, at) => addMesh(ballShape, pipe.material, at);

    const grow = (pipe) => {
        const free = d => {
            const next = pipe.at.map((v, i) => v + d[i]);
            return inside(next) && !filled.has(key(next));
        };
        let dir = pipe.dir && chance(0.5) && free(pipe.dir) ? pipe.dir : null;
        if (!dir) {
            const choices = DIRECTIONS.filter(free);
            if (!choices.length) {
                pipe.stuck = true;
                return;
            }
            dir = randomOf(choices);
        }
        const next = pipe.at.map((v, i) => v + dir[i]);
        filled.add(key(next));
        if (pipe.dir && pipe.dir !== dir) {
            addMesh(chance(ballChance) ? ballShape : elbowShape, pipe.material, pipe.at);
        }
        const piece = addMesh(pipeShape, pipe.material, pipe.at.map((v, i) => v + dir[i] / 2));
        piece.quaternion.setFromUnitVectors(up, new THREE.Vector3(...dir));
        pipe.at = next;
        pipe.dir = dir;
    };

    const look = () => {
        if (chance(0.5)) {
            camera.position.set(0, 0, CAMERA_DISTANCE);
        } else {
            const axis = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
            camera.position.set(CAMERA_DISTANCE, 0, 0).applyAxisAngle(axis, Math.PI / 2);
        }
        camera.lookAt(0, 0, 0);
    };

    const startRound = () => {
        scene.remove(group);
        group = new THREE.Group();
        scene.add(group);
        for (const pipe of pipes) {
            pipe.material.dispose();
        }
        filled = new Set();
        pipes = [];
        // elbows only, ball joints only, or a mix, as the original's choice per round
        ballChance = randomOf([0, 1, 1 / 3]);
        look();
        const count = 2 + (chance(0.1) ? 1 : 0);
        for (let i = 0; i < count; i++) {
            addPipe();
        }
    };
    startRound();

    /* the checkerboard dissolve, a block at a time, to black */
    let dissolve = null;
    let nextDissolve = performance.now() + 16000 + Math.random() * 8000;
    const startDissolve = () => {
        const across = Math.ceil(window.innerWidth / 20);
        const down = Math.ceil(window.innerHeight / 20);
        const blocks = Array.from({ length: across * down }, (_, i) => [i % across, Math.floor(i / across)]);
        for (let i = blocks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }
        dissolve = { blocks, index: 0, perFrame: Math.ceil(blocks.length / 120) };
    };
    const stepDissolve = () => {
        ctx.fillStyle = '#000000';
        for (let i = 0; i < dissolve.perFrame && dissolve.index < dissolve.blocks.length; i++, dissolve.index++) {
            const [x, y] = dissolve.blocks[dissolve.index];
            ctx.fillRect(x * 20, y * 20, 20, 20);
        }
        if (dissolve.index >= dissolve.blocks.length) {
            dissolve = null;
            startRound();
            renderer.render(scene, camera);
            ctx.clearRect(0, 0, veil.width, veil.height);
            nextDissolve = performance.now() + 16000 + Math.random() * 8000;
        }
    };

    let frame = 0;
    let tick = 0;
    const animate = () => {
        frame = requestAnimationFrame(animate);
        if (dissolve) {
            stepDissolve();
            return;
        }
        // one step every other frame keeps it near the original's pace
        if (++tick % 2 === 0) {
            pipes.filter(pipe => !pipe.stuck).forEach(grow);
        }
        renderer.render(scene, camera);
        if (performance.now() > nextDissolve || pipes.every(pipe => pipe.stuck)) {
            startDissolve();
        }
    };
    animate();

    return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        for (const pipe of pipes) {
            pipe.material.dispose();
        }
        for (const shape of [pipeShape, ballShape, elbowShape]) {
            shape.dispose();
        }
        renderer.dispose();
        renderer.forceContextLoss?.();
        holder.remove();
    };
}
