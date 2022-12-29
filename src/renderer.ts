// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Vector3, DirectionalLight, PerspectiveCamera, ShaderMaterial, Texture, AxesHelper } from 'three';
import THREE = require('three');

import Stats = require('stats.js');
import { GUI } from 'dat.gui';

import fs = require('fs');
import path = require('path')


const stats = new Stats()
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

import OrbitControls = require('three-orbitcontrols');
import FlyControls = require('three-flycontrols');

import MarchingCubes from "@bitheral/marching-cubes";
import { Volume, VolumeNew} from '@bitheral/marching-cubes/dist/MarchingCubes/Volume';

interface PBRMaterial {
    albedo: Texture;
    normal: Texture;
    roughness: Texture;
    displacement: Texture;
    ao: Texture;
}
function createPBRMaterial(texturePath: string): PBRMaterial {

    const pbrMaterial: PBRMaterial = {
        albedo: null,
        normal: null,
        roughness: null,
        displacement: null,
        ao: null
    }

    for(const file of fs.readdirSync(texturePath)) {
        if(!file.endsWith('.png')) {
            throw new Error(`File ${file} is not a png file`);
        }

        if(!['albedo', 'normal', 'roughness', 'displacement', 'ao'].includes(file.split('.')[0])) {
            throw new Error(`File ${file} is not a valid texture in ${texturePath}}`);
        }

        const texture = new THREE.TextureLoader().load(path.join(texturePath, file));
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        switch(file.split('.')[0]) {
            case 'albedo':
                pbrMaterial.albedo = texture;
                break;
            case 'normal':
                pbrMaterial.normal = texture;
                break;
            case 'roughness':
                pbrMaterial.roughness = texture;
                break;
            case 'displacement':
                pbrMaterial.displacement = texture;
                break;
            case 'ao':
                pbrMaterial.ao = texture;
                break;
        }
    }

    return pbrMaterial
}


const gui = new GUI();

// Example Three.js code
const scene = new THREE.Scene();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();
const INT16 = {
    MIN: -32768,
    MAX: 32767
}

const volumeSize = 32;
//const volume = new Volume(volumeSize, new Vector3(0, 0, 0));
//const volumeMesh = volume.mergeGeometries(volume.March());
//volume.mergeGeometries(volume.March());

const volume = new VolumeNew(volumeSize, new Vector3(0, 0, 0));

const orbit_controls = new OrbitControls(camera, renderer.domElement)
//const fly_controls = new FlyControls(camera, renderer.domElement)


renderer.setSize( window.innerWidth, window.innerHeight );

renderer.setClearColor( 0x000000, 0);
document.getElementById('webgl').appendChild(renderer.domElement);

orbit_controls.target = new Vector3(0,0,0).addScalar(volumeSize).divideScalar(2);

const light = new DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 0);
scene.add(light);

// Create an axes helper
const axesHelper = new AxesHelper( 5 );
scene.add( axesHelper );

const topTexture = createPBRMaterial(path.join(__dirname, 'src/assets/textures/Grass'));
const sideTexture = createPBRMaterial(path.join(__dirname, 'src/assets/textures/Gravel'));


const material = new ShaderMaterial({
    uniforms: {
        top: {
            value: {
                albedo: topTexture.albedo,
                normal: topTexture.normal,
                roughness: topTexture.roughness,
                displacement: topTexture.displacement,
                ao: topTexture.ao
            }
        },
        side: {
            value: {
                albedo: sideTexture.albedo,
                normal: sideTexture.normal,
                roughness: sideTexture.roughness,
                displacement: sideTexture.displacement,
                ao: sideTexture.ao
            }
        },
        noiseScale: {
            value: volume.noiseScale
        },
        volumeScale: {
            value: volume.getScale()
        },
        worldLight: {
            value: {
                position: light.position,
                direction: light.getWorldDirection(new Vector3()),
            }
        }
    },
    vertexShader: fs.readFileSync(path.join(__dirname, 'src/assets/shader/triplanar/vertex.glsl'), 'utf8'),
    fragmentShader: fs.readFileSync(path.join(__dirname, 'src/assets/shader/triplanar/fragment.glsl'), 'utf8'),
})

const mesh = new THREE.Mesh(volume.geometry, material);
mesh.position.set(0,0,0);

// volumeSize only increases the resolution of the mesh, not the volume
// Apply a scale to the mesh so that the world is 32/volumeSize units wide, and deep
// mesh.scale.multiplyScalar(volumeSize).multiplyScalar((1/volumeSize) * 4);

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
    },
    IncrementXNoise: () => {
        volume.noiseOffset.x += 0.25;
    },
    IncrementYNoise: () => {
        volume.noiseOffset.y += 0.25;
    },
    IncrementZNoise: () => {
        volume.noiseOffset.z += 0.25;
    }
}

gui.add(mesh.position, 'x', -volumeSize, volumeSize).name('Mesh Position (X axis)');
gui.add(mesh.position, 'y', -volumeSize, volumeSize).name('Mesh Position (Y axis)');
gui.add(mesh.position, 'z', -volumeSize, volumeSize).name('Mesh Position (Z axis)');

// Create a gui folder for the volume's noise settings
const noiseFolder = gui.addFolder('Noise Settings');
noiseFolder.add(volume, 'seed', INT16.MIN, INT16.MAX).onChange(() => updateMesh()).name('Noise Seed');
noiseFolder.add(volume, 'noiseScale', 0.01, 10).onChange(() => updateMesh()).name('Noise Scale');

{
const noiseOffsetFolder = noiseFolder.addFolder('Noise Offset');
noiseOffsetFolder.add(volume.noiseOffset, 'x', INT16.MIN, INT16.MAX).onChange(() => updateMesh());
noiseOffsetFolder.add(volume.noiseOffset, 'y', INT16.MIN, INT16.MAX).onChange(() => updateMesh());
noiseOffsetFolder.add(volume.noiseOffset, 'z', INT16.MIN, INT16.MAX).onChange(() => updateMesh());
noiseOffsetFolder.add(obj, 'IncrementXNoise').name('Increment Noise Offset (X axis)').onChange(() => updateMesh());
noiseOffsetFolder.add(obj, 'IncrementYNoise').name('Increment Noise Offset (Y axis)').onChange(() => updateMesh());
noiseOffsetFolder.add(obj, 'IncrementZNoise').name('Increment Noise Offset (Z axis)').onChange(() => updateMesh());
}

const volumeFolder = gui.addFolder('Volume Settings');
volumeFolder.add(volume, 'densityThreshold', 0, 1).onChange(() => updateMesh()).name('Density Threshold');
volumeFolder.add(volume, 'yBias', 0, volumeSize).onChange(() => updateMesh()).name('Y Bias');
volumeFolder.add(volume, 'showEdges').onChange(() => updateMesh()).name('Show Edges');
volumeFolder.add(volume, 'edgeSharpness', 0, 10).onChange(() => updateMesh()).name('Edge Sharpness');

// Add a button to gui to regenerate the volume
gui.add(obj, 'Regenerate').onFinishChange(() => updateMesh());

// Camera orbit around center of the volume
function animate() {
    requestAnimationFrame(animate)
    render()
    orbit_controls.update();
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