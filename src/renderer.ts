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
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

// OrbitControls.js
//import OrbitControls = require('three-orbitcontrols-ts');
import OrbitControls = require('three-orbitcontrols');

import MarchingCubes from "@bitheral/marching-cubes";
import Volume from '@bitheral/marching-cubes/dist/MarchingCubes/Volume';

const gui = new GUI();

// Example Three.js code
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();
const INT16 = {
    MIN: -32768,
    MAX: 32767
}

const volumeSize = 15;
const volume = new Volume(volumeSize, new Vector3(0, 0, 0));
const volumeMesh = volume.mergeGeometries(volume.March());


const controls = new OrbitControls(camera, renderer.domElement)


renderer.setSize( window.innerWidth, window.innerHeight );

renderer.setClearColor( 0x000000, 0);
document.getElementById('webgl').appendChild( renderer.domElement );

// const volume = new MarchingCubes.Volume(15, new Vector3(0, 0, 0));
// const volumeMesh = volume.mergeGeometries(volume.March());

controls.target = new Vector3(0,0,0).addScalar(volumeSize).divideScalar(2);


const mesh = new THREE.Mesh(volumeMesh, new THREE.MeshLambertMaterial({color: 0xffffff, wireframe: false}));
mesh.position.set(0,0,0);
scene.add(mesh);

function updateMesh() {
    volume.update("geometry");
    mesh.geometry.dispose();
    mesh.geometry = volume.geometry;
}

const obj = {
    Regenerate: () => {
        volume.seed = Date.now();
        volume.noiseSeed = Volume.createSeed(volume.seed);
    }
}

// Create a gui folder for the volume's noise settings
const noiseFolder = gui.addFolder('Noise Settings');
noiseFolder.add(volume, 'seed', INT16.MIN, INT16.MAX).onFinishChange(() => updateMesh()).name('Noise Seed');
noiseFolder.add(volume, 'noiseScale', 0.01, 10).onFinishChange(() => updateMesh()).name('Noise Scale');
{
const noiseOffsetFolder = noiseFolder.addFolder('Noise Offset');
noiseOffsetFolder.add(volume.noiseOffset, 'x', INT16.MIN, INT16.MAX).onFinishChange(() => updateMesh());
noiseOffsetFolder.add(volume.noiseOffset, 'y', INT16.MIN, INT16.MAX).onFinishChange(() => updateMesh());
noiseOffsetFolder.add(volume.noiseOffset, 'z', INT16.MIN, INT16.MAX).onFinishChange(() => updateMesh());
}

const volumeFolder = gui.addFolder('Volume Settings');
volumeFolder.add(volume, 'densityThreshold', 0, 1).onFinishChange(() => updateMesh()).name('Density Threshold');
volumeFolder.add(volume, 'yBias', 0, volumeSize).onFinishChange(() => updateMesh()).name('Y Bias');
volumeFolder.add(volume, 'showEdges').onFinishChange(() => updateMesh()).name('Show Edges');
volumeFolder.add(volume, 'edgeSharpness', 0, 10).onFinishChange(() => updateMesh()).name('Edge Sharpness');

// Add a button to gui to regenerate the volume
gui.add(obj, 'Regenerate').onFinishChange(() => updateMesh());

const light = new DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 0);
scene.add(light);

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