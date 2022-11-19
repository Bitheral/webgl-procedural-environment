// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Float32BufferAttribute, Vector2, Vector3 } from 'three';
import THREE = require('three');

// OrbitControls.js
//import OrbitControls = require('three-orbitcontrols-ts');
import OrbitControls = require('three-orbitcontrols');



// Example Three.js code
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();

const controls = new OrbitControls(camera, renderer.domElement)

renderer.setSize( window.innerWidth, window.innerHeight );

renderer.setClearColor( 0x000000, 0);
document.getElementById('webgl').appendChild( renderer.domElement );

const material = new THREE.MeshLambertMaterial( { color: 0x00ff00, wireframe: true } );


// Simple box geometry
const box = new THREE.BoxGeometry();


const planeResolution = 10;
const planeGeometry = new THREE.PlaneGeometry(planeResolution, planeResolution, planeResolution, planeResolution);
planeGeometry.rotateX(-Math.PI / 2)

// Move it to the center
const mesh = new THREE.Mesh(planeGeometry, material);
mesh.position.set(0, 0, 0);


const objectsInScene = 10;
for (let i = 0; i < objectsInScene; i++) {
    box.clone().scale(1,2,1);
    const mat = material.clone();
    mat.wireframe = false;
    // Randomise color
    const colour = Math.random() * 0xffffff;
    mat.color.setHex(colour);

    const mesh = new THREE.Mesh(box, mat);
    // Random number between 0 and planeResolution
    const x = Math.floor(Math.random() * planeResolution - (planeResolution / 2));
    const z = Math.floor(Math.random() * planeResolution - (planeResolution / 2));
    mesh.position.set(x, 0.5, z);
    scene.add(mesh);

    const light = new THREE.PointLight(colour, 1, 5)
    light.position.set(x, 2, z)

    const lightV = box.clone().scale(0.1, 0.1, 0.1);
    const lightR = new THREE.SphereGeometry(light.distance / 2, 128, 128);
    const idV = new THREE.Mesh(lightV, new THREE.MeshBasicMaterial({color: colour}));
    const idR = new THREE.Mesh(lightR, new THREE.MeshBasicMaterial({color: colour, wireframe: true}));

    idV.position.set(light.position.x, light.position.y, light.position.z);
    idR.position.set(light.position.x, light.position.y, light.position.z);
    scene.add(light)
}

scene.add( mesh );
camera.position.set(0, 8, 10);

function animate() {
    requestAnimationFrame(animate)
    controls.update()
    render()
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