// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Vector3, DirectionalLight, PerspectiveCamera, ShaderMaterial, Texture, AxesHelper, Intersection, Vector } from 'three';
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

const ObjectScattering = {
    density: 100,
    points: [] as Vector3[],
    intersects: [] as Intersection[]
}

const orbit_controls = new OrbitControls(camera, renderer.domElement)
//const fly_controls = new FlyControls(camera, renderer.domElement)

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

function distributeObjects(pointCount: number) {
    const objects = [];

    for(let i = 0; i < pointCount; i++) {
        const position = new Vector3(
            Math.random() * (volumeSize - 1),
            Math.random() * volumeSize,
            Math.random() * (volumeSize - 1)
        );
        
        const xCoord = (position.x / volumeSize) * volume.noiseScale + volume.noiseOffset.x;
        const yCoord = (position.y / volumeSize) * volume.noiseScale + volume.noiseOffset.y;
        const zCoord = (position.z / volumeSize) * volume.noiseScale + volume.noiseOffset.z;

        const noiseValue = volume.noise.perlin["3D"](xCoord, yCoord, zCoord);

        // Get density around this point
        let kernel = [];
        for(let x = -1; x <= 1; x++) {
            for(let y = -1; y <= 1; y++) {
                for(let z = -1; z <= 1; z++) {
                    const xCoord = ((position.x + x) / volumeSize) * volume.noiseScale + volume.noiseOffset.x;
                    const yCoord = ((position.y + y) / volumeSize) * volume.noiseScale + volume.noiseOffset.y;
                    const zCoord = ((position.z + z) / volumeSize) * volume.noiseScale + volume.noiseOffset.z;

                    const noiseValue = volume.noise.perlin["3D"](xCoord, yCoord, zCoord);
                    kernel.push(noiseValue);
                }
            }
        }

        const kernelSum = kernel.reduce((a, b) => a + b, 0);

        const heightBias = (position.y / volumeSize);

        const density = heightBias + (position.y / volume.yBias) - noiseValue;

        // const viablePoint = density > volume.densityThreshold && density - kernelSum < 0.1;
        const viablePoint = true;

        // Based on the density, add the point to the array
        if(viablePoint) 
            objects.push(position);
    }

    return objects;
}

interface ObjectScatters {
    points: Vector3[];
    intersects: Intersection[];
}
function snapToTerrain(volumeMesh: THREE.Mesh, points: Vector3[]): ObjectScatters {
    // Vertices is a flat array of x, y, z, x, y, z, x, y, z, etc
    // Points is an array of Vector3s

    // For each point, raycast down to the terrain and set the y value to the y value of the terrain
    const newPoints = [];
    const intersections = [];

    for(const point of points) {
        const raycaster = new THREE.Raycaster(point, new Vector3(0, -1, 0), 0, volumeSize);
        const intersects = raycaster.intersectObject(volumeMesh);

        if(intersects.length > 0) {
            const newPoint = new Vector3(point.x, intersects[0].point.y, point.z);
            newPoints.push(newPoint);
            intersections.push(intersects[0]);
        }
    }

    return {
        points: newPoints,
        intersects: intersections
    };
}

function createInstancedMesh(geometry: THREE.BufferGeometry, material: THREE.Material, scattering: ObjectScatters): THREE.InstancedMesh {

    // Valid points are the points that have their intersects.face.normal.normalized().y > 0;
    const validPoints = [];


    for(let i = 0; i < scattering.intersects.length; i++) {
        const normal = scattering.intersects[i].face.normal.clone().normalize();

        if(normal.y >= 0.9) {
            validPoints.push(scattering.points[i]);
        }
    }

    const count = validPoints.length;
    const positions = validPoints;

    // Make sure that the positions is within 1 and volumeSize - 1
    for(const position of positions) {
        if(position.x < 1 || position.x > volumeSize - 1) {
            position.x = Math.random() * (volumeSize - 1);
        }
        if(position.y < 1 || position.y > volumeSize - 1) {
            position.y = (Math.random() * volumeSize) - (volume.yBias / volumeSize);
        }
        if(position.z < 1 || position.z > volumeSize - 1) {
            position.z = Math.random() * (volumeSize - 1);
        }
    }



    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    for(let i = 0; i < count; i++) {
        if(positions.length == 0) {
            dummy.position.set(
                Math.random() * (volumeSize - 1),
                Math.random() * volumeSize,
                Math.random() * (volumeSize - 1)
            );
        }
        else {
            dummy.position.set(
                positions[i].x,
                positions[i].y,
                positions[i].z
            );
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    return mesh;
}


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

ObjectScattering.points = distributeObjects(ObjectScattering.density);
const objectScatters = snapToTerrain(mesh, ObjectScattering.points);

ObjectScattering.points = objectScatters.points;
ObjectScattering.intersects = objectScatters.intersects;

let sphereMesh = createInstancedMesh(new THREE.SphereGeometry(Math.random(), 16, 16), new THREE.MeshBasicMaterial({color: 0x00ff00}), ObjectScattering);
sphereMesh.name = "instancedMesh";
scene.add(sphereMesh);

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

// Create an item in the volume folder where we can change the density of the volumePoints, using a slider
volumeFolder.add(ObjectScattering, 'density', 1, 10000).onChange((value) => {
    // Remove any object named "instancedMesh"
    scene.remove(scene.getObjectByName("instancedMesh"));

    // Generate new points
    ObjectScattering.points = distributeObjects(value);
    const objectScatters = snapToTerrain(mesh, ObjectScattering.points);

    ObjectScattering.points = objectScatters.points;
    ObjectScattering.intersects = objectScatters.intersects;

    // Create a new instanced mesh
    sphereMesh = createInstancedMesh(new THREE.SphereGeometry(Math.random(), 16, 16), new THREE.MeshBasicMaterial({color: 0x00ff00}), ObjectScattering);
    sphereMesh.name = "instancedMesh";

    // Add the new instanced mesh to the scene
    scene.add(sphereMesh);
}).name('Voroni Density');

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