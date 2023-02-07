// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Vector3, DirectionalLight, PerspectiveCamera, ShaderMaterial, Texture, AxesHelper, Intersection, Vector, Vector2, MeshBasicMaterial, BufferGeometry, LoadingManager, Object3D } from 'three';

// Import objloader from local file
import OBJLoader from './OBJLoader.js';

import THREE = require('three');

import Stats = require('stats.js');
import { GUI } from 'dat.gui';

import fs = require('fs');
import path = require('path')

import OrbitControls = require('three-orbitcontrols');
import FirstPersonControls from './FlyCamera.js';

import MarchingCubes from "@bitheral/marching-cubes";
import { Volume, VolumeNew } from '@bitheral/marching-cubes/dist/MarchingCubes/Volume';
import { Noise, NoiseData } from '@bitheral/marching-cubes/dist/Noise';


const stats = new Stats()
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

interface PBRMaterial {
    albedo: Texture;
    normal: Texture;
    roughness: Texture;
    displacement: Texture;
    ao: Texture;
}

interface Shader {
    vertexShader: string,
    fragmentShader: string,
    glslVersion: THREE.GLSLVersion
}



const gui = new GUI();

// Example Three.js code
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();

const volumeSize = 32;
const volumesAmount = 1;

const volumes = [] as VolumeNew[];
for(let z = 0; z < volumesAmount; z++) {
    for(let x = 0; x < volumesAmount; x++) {

        const pos = new Vector3(x, 0, z);

        const volume = new VolumeNew(volumeSize, pos);
        volume.March();

        volumes.push(volume);
    }
}

for(let i = 0; i < volumes.length; i++) {
    const volume = volumes[i];

    // Get neighbours (including corners)
    const neighbours = {
        front: null as VolumeNew,
        back: null as VolumeNew,
        left: null as VolumeNew,
        right: null as VolumeNew,
        top: null as VolumeNew,
        
        frontLeft: null as VolumeNew,
        frontRight: null as VolumeNew,
        backLeft: null as VolumeNew,
        backRight: null as VolumeNew
    }

    const x = i % volumesAmount;
    const z = Math.floor(i / volumesAmount);

    if(x > 0) {
        neighbours.left = volumes[i - 1];
    }

    if(x < volumesAmount - 1) {
        neighbours.right = volumes[i + 1];
    }

    if(z > 0) {
        neighbours.back = volumes[i - volumesAmount];
    }

    if(z < volumesAmount - 1) {
        neighbours.front = volumes[i + volumesAmount];
    }

    if(neighbours.left && neighbours.back) {
        neighbours.backLeft = volumes[i - volumesAmount - 1];
    }

    if(neighbours.right && neighbours.back) {
        neighbours.backRight = volumes[i - volumesAmount + 1];
    }

    if(neighbours.left && neighbours.front) {
        neighbours.frontLeft = volumes[i + volumesAmount - 1];
    }

    if(neighbours.right && neighbours.front) {
        neighbours.frontRight = volumes[i + volumesAmount + 1];
    }

    volume.neighbours = neighbours;
}



const volume = volumes[0];

let ObjectScattering = {
    density: 100,
    points: [] as Vector3[],
    intersects: [] as Intersection[]
}

const orbit_controls = new OrbitControls(camera, renderer.domElement)
//const fly_controls = new FirstPersonControls(camera, renderer.domElement);
// fly_controls.movementSpeed = 150;
// fly_controls.lookSpeed = 0.1;
//fly_controls.activeLook = false;

camera.position.set(volumeSize * 0.5, volumeSize * 0.5, -volumeSize * 1.5);
camera.lookAt(volumeSize * 0.5, volumeSize * 0.5, volumeSize * 0.5);


function createShader(shaderName: string): Shader {
    return {
        vertexShader: fs.readFileSync(path.join(__dirname, `./assets/shader/${shaderName}/vertex.glsl`), 'utf-8'),
        fragmentShader: fs.readFileSync(path.join(__dirname, `./assets/shader/${shaderName}/fragment.glsl`), 'utf-8'),
        glslVersion: THREE.GLSL3
    }
}

function createPBRMaterial(texturePath: string, fileExtension: string = "png"): PBRMaterial {

    const pbrMaterial: PBRMaterial = {
        albedo: null,
        normal: null,
        roughness: null,
        displacement: null,
        ao: null
    }

    for(const file of fs.readdirSync(texturePath)) {
        if(!file.endsWith('.' + fileExtension)) {
            throw new Error(`File ${file} is not a ${fileExtension} file`);
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

// Return a tuple of the positions and the amount of points


function distributeObjects(pointCount: number) {
    const objects = [];

    for(let i = 0; i < pointCount; i++) {
        const position = new Vector3(
            Math.random() * (volumeSize - 2) + 2,
            Math.random() * volumeSize,
            Math.random() * (volumeSize - 2) + 2
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

interface MatrixSettings {
    // Position
    // Rotation
    // Scale
    // All of these are Vector3s, but they can be null
    position: Vector3 | null;
    rotation: Vector3 | null;
    scale: Vector3 | null;
}
function createInstancedMesh(geometry: THREE.BufferGeometry, material: THREE.Material, scattering: ObjectScatters, matrixSettings: MatrixSettings): THREE.InstancedMesh {

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

    const mesh = new THREE.InstancedMesh(geometry, material, count);

    for(let i = 0; i < count; i++) {
        const position = positions[i];
        const translation = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);

        // Random rotation in any direction
        const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2));

        const scale = new THREE.Matrix4().makeScale(1, 1, 1);

        const matrixP = new THREE.Matrix4();

        if(matrixSettings.position) {
            matrixP.makeTranslation(matrixSettings.position.x, matrixSettings.position.y, matrixSettings.position.z);
        }

        const matrixR = new THREE.Matrix4();

        if(matrixSettings.rotation) {
            matrixR.makeRotationFromEuler(new THREE.Euler(matrixSettings.rotation.x, matrixSettings.rotation.y, matrixSettings.rotation.z));
        }

        const matrixS = new THREE.Matrix4();

        if(matrixSettings.scale) {
            matrixS.makeScale(matrixSettings.scale.x, matrixSettings.scale.y, matrixSettings.scale.z);
        }


        translation.multiply(matrixP);
        rotation.multiply(matrixR);
        scale.multiply(matrixS);


        const matrix = new THREE.Matrix4();
        matrix.multiply(translation);
        matrix.multiply(rotation);
        matrix.multiply(scale);

        mesh.setMatrixAt(i, matrix);
    }


    return mesh;
}

renderer.setSize( window.innerWidth, window.innerHeight );

renderer.setClearColor( 0x000000, 0);
document.getElementById('webgl').appendChild(renderer.domElement);

orbit_controls.target = new Vector3(0,0,0).addScalar(volumeSize).divideScalar(2);
//fly_controls.target = new Vector3(0,0,0).addScalar(volumeSize).divideScalar(2);

const light = new DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 0);
scene.add(light);

// Create an axes helper
const axesHelper = new AxesHelper( 5 );
scene.add( axesHelper );

const topTexture = createPBRMaterial(path.join(__dirname, './assets/textures/Grass'));
const sideTexture = createPBRMaterial(path.join(__dirname, './assets/textures/Rock'));
const bottomTexture = createPBRMaterial(path.join(__dirname, './assets/textures/Gravel'));

const Rock002 = createPBRMaterial(path.join(__dirname, './assets/textures/Rock002'), 'jpg');

const MaterialUniform = (material: PBRMaterial) => {
    return {
        albedo: material.albedo,
        normal: material.normal,
        roughness: material.roughness,
        displacement: material.displacement,
        ao: material.ao
    }
}

const volumeMaterial = new ShaderMaterial({
    uniforms: {
        top: {
            value: MaterialUniform(topTexture)
        },
        bottom: {
            value: MaterialUniform(sideTexture)
        },
        xAx: {
            value: MaterialUniform(sideTexture)
        },
        zAx: {
            value: MaterialUniform(sideTexture)
        },            
        noiseScale: {
            value: volume.noiseScale
        },
        volumeScale: {
            value: volumeSize * volumesAmount
        },
        worldLight: {
            value: {
                position: light.position,
                direction: light.getWorldDirection(new Vector3()),
            }
        }
    },
    ...createShader("triplanar")

})

const oldRock = new MeshBasicMaterial({ color: 0xff0000 });
// For each volume in volumes, merge the geometries
const volumeGeos = [] as BufferGeometry[];
for(const volume of volumes) {
    const geo = volume.geometry;
    volumeGeos.push(geo);
}

const mergedGeo = Volume.mergeGeometries(volumeGeos);
const mesh = new THREE.Mesh(mergedGeo || volume.geometry, volumeMaterial);
mesh.position.set(0,0,0);
scene.add(mesh);
   
// Load model from OBJ file
const loader = new OBJLoader()

function updateMesh() {
    for(const volume of volumes) {
        volume.update("noise");
        volume.update("geometry");
    }

    mesh.geometry.dispose();
    mesh.geometry = volume.geometry;

    const volumeGeos = volumes.map(volume => volume.geometry);
    const mergedGeo = Volume.mergeGeometries(volumeGeos);
    mesh.geometry = mergedGeo;

    ObjectScattering.points = distributeObjects(ObjectScattering.density);
    ObjectScattering = {
        ...ObjectScattering,
        ...snapToTerrain(mesh, ObjectScattering.points)
    }

    loader.load(path.join(__dirname, './assets/models/Rock002.obj'),
    (object: Object3D) => {
        const objMesh = object.children[0] as THREE.Mesh;

        const rockMaterial = new ShaderMaterial({
            uniforms: {
                mat: {
                    value: {
                        ...MaterialUniform(Rock002)
                    }
                },
                volumeScale: {
                    value: volumeSize * volumesAmount
                },
            },
            ...createShader("objectScatter")
        })

        const mesh = createInstancedMesh(objMesh.geometry, rockMaterial, ObjectScattering, {
            position: null,
            rotation: null,
            scale: new Vector3(5,5,5)
        });
            
        for(let i = 0; i < scene.children.length; i++) {
            const child = scene.children[i];
            if(child.name === "rock002") {
                scene.remove(child);
            }
        }
        mesh.name = "rock002";
        scene.add(mesh);

        //scene.add(object);

    },
    () => { return },
    (error: Error) => {
        console.log('An error happened');
        console.error(error);
    }
);
}


//#region GUI
gui.add(mesh.position, 'x', -volumeSize, volumeSize).name('Mesh Position (X axis)');
gui.add(mesh.position, 'y', -volumeSize, volumeSize).name('Mesh Position (Y axis)');
gui.add(mesh.position, 'z', -volumeSize, volumeSize).name('Mesh Position (Z axis)');

const ob = {
    seed: volume.seed,
}

const noiseFolder = gui.addFolder('Noise Settings');
noiseFolder.add(ob, 'seed', -65566, 65536).onChange(() => {
    volume.seed = ob.seed;
    volume.noiseSeed = Volume.createSeed(volume.seed);
    updateMesh();
}).name('Noise Seed');
let noiseConfigsFolder = noiseFolder.addFolder('Noise Configs');

const params = {
    'configs': [
        {
            'scale': 1,
            'octaves': 4,
            'persistence': 0.5,
            'lacunarity': 2,
            'offset': new Vector3(0,0,0),
            'open': false
        },
    ],
    'densityThreshold': volume.densityThreshold,
    'yBias': volume.yBias,
    'showEdges': volume.showEdges,
    'edgeSharpness': volume.edgeSharpness,

    objects: {
        'density': ObjectScattering.density,
    },

    actions: {
        addConfig: () => {
            params.configs.push({
                'scale': 1,
                'octaves': 4,
                'persistence': 0.5,
                'lacunarity': 2,
                'offset': new Vector3(0,0,0),
                'open': false
            });

            // Refresh the folder so that the new config is added
            noiseFolder.removeFolder(noiseConfigsFolder);
            noiseConfigsFolder = noiseFolder.addFolder('Noise Configs');
            noiseConfigsFolder.open();
            params.actions.createConfigFolders()

            params.actions.regenerate();
        },
        removeConfig: () => {
            if(params.configs.length <= 1) return;

            params.configs.pop();
            noiseFolder.removeFolder(noiseConfigsFolder);
            noiseConfigsFolder = noiseFolder.addFolder('Noise Configs');
            noiseConfigsFolder.open();

            params.actions.createConfigFolders();

            params.actions.regenerate();
        },
        updateConfig(index: number) {
            const config = params.configs[index];
            for(const volume of volumes) {
                volume.noiseConfigs[index] = config;
            }

            updateMesh();
        },
        update(key: string) {
            for(const volume of volumes) {
                switch(key) {
                    case 'seed':
                        volume.seed = ob.seed;
                        volume.noiseSeed = Volume.createSeed(volume.seed);
                        break;
                    case 'densityThreshold':
                        volume.densityThreshold = params.densityThreshold;
                        break;
                    case 'yBias':
                        volume.yBias = params.yBias;
                        break;
                    case 'showEdges':
                        volume.showEdges = params.showEdges;
                        break;
                    case 'edgeSharpness':
                        volume.edgeSharpness = params.edgeSharpness;
                        break;

                    case 'density':
                        ObjectScattering.density = params.objects.density;
                        ObjectScattering.points = distributeObjects(ObjectScattering.density);
                        break;
                                
                    default:
                        break;
                }
            }
            
            updateMesh();
        },
        regenerate: () => {
            for(const volume of volumes) {
                volume.noiseConfigs = params.configs;
                volume.noiseSeed = Volume.createSeed(volume.seed);
            }

            updateMesh();
        },
        createConfigFolders: () => {
            for(let i = 0; i < params.configs.length; i++) {
                const config = params.configs[i];
                const configFolder = noiseConfigsFolder.addFolder(`Config ${i+1}`);
                            
                if(config.open) {
                    configFolder.open();
                }
        
                configFolder.add(config, 'scale', 0.1, 10).name('Scale').onChange(() => params.actions.updateConfig(i));
                configFolder.add(config, 'octaves', 1, 10).name('Octaves').onChange(() => params.actions.updateConfig(i));
                configFolder.add(config, 'persistence', 0.1, 1).name('Persistence').onChange(() => params.actions.updateConfig(i));
                configFolder.add(config, 'lacunarity', 1, 10).name('Lacunarity').onChange(() => params.actions.updateConfig(i));
                const offsetFolder = configFolder.addFolder('Offset');
                offsetFolder.add(config.offset, 'x', -volumeSize, volumeSize).name('X').onChange(() => params.actions.updateConfig(i));
                offsetFolder.add(config.offset, 'y', -volumeSize, volumeSize).name('Y').onChange(() => params.actions.updateConfig(i));
                offsetFolder.add(config.offset, 'z', -volumeSize, volumeSize).name('Z').onChange(() => params.actions.updateConfig(i));
        
                config.open = !configFolder.closed;
            }
            noiseConfigsFolder.add(params.actions, 'addConfig').onFinishChange(() => updateMesh()).name("Add");
            noiseConfigsFolder.add(params.actions, 'removeConfig').onFinishChange(() => updateMesh()).name("Remove");
        }
    }
}

// noiseFolder.add(params, 'noiseScale', 0.01, 10).onChange(() => params.actions.update("noiseScale")).name('Noise Scale');

const volumeFolder = gui.addFolder('Volume Settings');
volumeFolder.add(params, 'densityThreshold', -1, 1).onChange(() => params.actions.update("densityThreshold")).name('Density Threshold');
volumeFolder.add(params, 'yBias', 0, volumeSize).onChange(() => params.actions.update("yBias")).name('Y Bias');
volumeFolder.add(params, 'showEdges').onChange(() => params.actions.update("showEdges")).name('Show Edges');
volumeFolder.add(params, 'edgeSharpness', 0, 100).onChange(() => params.actions.update("edgeSharpness")).name('Edge Sharpness');
volumeFolder.add(params.actions, 'regenerate').name('Regenerate');

const objectFolder = gui.addFolder('Object Settings');
objectFolder.add(params.objects, 'density', 0, 100).onChange(() => params.actions.update("density")).name('Density');

params.actions.createConfigFolders()
updateMesh();

//#endregion

// Camera orbit around center of the volume
function animate() {
    requestAnimationFrame(animate)
    render()
    stats.update();
}

function render() {
    orbit_controls.update(clock.getDelta());
    //fly_controls.update(clock.getDelta());
    renderer.render(scene, camera)

}

// Event Listeners
window.addEventListener('resize', onWindowResize, false)

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight)
    //fly_controls.handleResize();
}

//fly_controls.lookAt(new Vector3(volumeSize * 0.5, volumeSize * 0.5, volumeSize * 0.5));
animate();