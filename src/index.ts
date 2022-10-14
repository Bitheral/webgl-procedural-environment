import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
//import { perlinNoise3d } from "perlin-noise-3d";


// Create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.0001, 1000);
camera.position.z = 5;

const light1 = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(light1);

// Create point light
const light = new THREE.PointLight(0xffffff, 10, 10);
light.position.set(0, 5, 0);
scene.add(light);


const controls = new OrbitControls(camera, renderer.domElement);
//const noise = new perlinNoise3d();

let size = 1;
const geometry = new THREE.BoxGeometry(size, size, size);
const material = new THREE.MeshLambertMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

// const mCubes = new MarchingCubes();
// mCubes.generatesGrid(5);

// const geometry = mCubes.March();
// const material = new THREE.MeshLambertMaterial( { color: 0x00ff00 } );
// const cube = new THREE.Mesh( geometry, material );
// scene.add( cube );

function animate() {
    controls.update();

    //noise.noiseSeed(new Date().getTime());
    //size = noise.get(0 + camera.position.x, 0 + camera.position.y, 0 + camera.position.z);
    //cube.scale.set(size, size, size);

    requestAnimationFrame(animate);
    renderer.render( scene, camera);
};

animate();