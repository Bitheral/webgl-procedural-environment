// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Float32BufferAttribute, Vector2, BufferGeometry, Vector3, DirectionalLight } from 'three';
import THREE = require('three');

import Stats = require('stats.js');
import { GUI } from 'dat.gui';


const stats = new Stats()
stats.showPanel( 1 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

// OrbitControls.js
//import OrbitControls = require('three-orbitcontrols-ts');
import OrbitControls = require('three-orbitcontrols');

import MarchingCubes from "@bitheral/marching-cubes";

const gui = new GUI();

// Example Three.js code
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();

const controls = new OrbitControls(camera, renderer.domElement)

renderer.setSize( window.innerWidth, window.innerHeight );

renderer.setClearColor( 0x000000, 0);
document.getElementById('webgl').appendChild( renderer.domElement );

const volume = new MarchingCubes.Volume(15, new Vector3(0, 0, 0), 0.3);
const volumeMesh = volume.mergeGeometries(volume.March());

// Create a gui folder for the volume's noise settings
const noiseFolder = gui.addFolder('Noise Settings');
noiseFolder.add(volume, 'noiseScale', 0, 1);

controls.target = new Vector3(volume.getScale() * 0.5, volume.getScale() * 0.5, volume.getScale() * 0.5);

const mesh = new THREE.Mesh(volumeMesh, new THREE.MeshLambertMaterial({color: 0xffffff, wireframe: false}));
mesh.position.set(0,0,0);
scene.add(mesh);

const light = new DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 0);
scene.add(light);


// Create an image which shows the noise
const noiseCanvas = document.createElement('canvas');
noiseCanvas.width = 256;
noiseCanvas.height = 256;

const noiseContext = noiseCanvas.getContext('2d');
const noiseImageData = noiseContext.createImageData(noiseCanvas.width, noiseCanvas.height);
const noiseData = noiseImageData.data;
for(let y = 0; y < noiseCanvas.height; y++) {
    for(let x = 0; x < noiseCanvas.width; x++) {
        const index = (x + y * noiseCanvas.width) * 4;
        const value = volume.noise["2D"](x / noiseCanvas.width, y / noiseCanvas.height);
        noiseData[index] = value * 255;
        noiseData[index + 1] = value * 255;
        noiseData[index + 2] = value * 255;
        noiseData[index + 3] = 255;
    }
}

noiseContext.putImageData(noiseImageData, 0, 0);
document.getElementById('noise').appendChild(noiseCanvas);



//camera.position.set(0, 8, 10);

// Camera orbit around center of the volume

function animate() {
    requestAnimationFrame(animate)
    controls.update()
    render()
    stats.update();
}

function render() {
    renderer.render(scene, camera)
}

animate()



// Event Listeners
window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}