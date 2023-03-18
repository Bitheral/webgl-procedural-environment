// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Vector3, DirectionalLight, PerspectiveCamera, ShaderMaterial, Texture, AxesHelper, Intersection, Vector, Vector2, MeshBasicMaterial, BufferGeometry, LoadingManager, Object3D, Material } from 'three';

// Import objloader from local file
import { OBJLoader, MTLLoader } from './loaders';

import THREE = require('three');

import Stats = require('stats.js');
import { GUI } from 'dat.gui';

import fs = require('fs');
import path = require('path')

import OrbitControls = require('three-orbitcontrols');

import MarchingCubes from "@bitheral/marching-cubes";
import { Volume, VolumeNew } from '@bitheral/marching-cubes/dist/MarchingCubes/Volume';
import { Noise, NoiseData } from '@bitheral/marching-cubes/dist/Noise';


const stats = new Stats()
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

const volumeSize = 64;
const volumesAmount = 1;

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

const models = [] as THREE.Mesh[];

interface ShaderPBR {
    albedo: THREE.Texture;
    normal: THREE.Texture;
    roughness: THREE.Texture;
    displacement: THREE.Texture;
    ao: THREE.Texture;
}
const MaterialUniform = (material: PBRMaterial) => {
    const result: ShaderPBR = {
        albedo: material.albedo,
        normal: material.normal,
        roughness: material.roughness,
        displacement: material.displacement,
        ao: material.ao
    }
    return result;
}

const Rock002 = createPBRMaterial(path.join(__dirname, './assets/textures/Rock002'), 'jpg');

// Example Three.js code
const scene = new THREE.Scene();
const light = new DirectionalLight(0xffffff, 1);
light.position.set(volumeSize, volumeSize * 2, -volumeSize);
light.shadow.camera.lookAt(new Vector3(volumeSize * 0.5, 1, volumeSize * 0.5));
light.castShadow = true;
scene.add(light);

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const materials = {
    "Rock002": new ShaderMaterial({
        uniforms: {
            mat: {
                value: {
                    ...MaterialUniform(Rock002)
                }
            },
            volumeScale: {
                value: volumeSize * volumesAmount
            },
            worldLight: {
                value: {
                    position: light.position,
                    direction: light.getWorldDirection(new Vector3()),
                }
            },
            viewPosition: {
                value: camera.position
            }
        },
        ...createShader("objectScatter/rock")
    })
} as { [key: string]: THREE.Material };


// Mark as deprecated
function addModel(model: Object3D, name: string, ignoreMaterial = false) {
    const modelMesh = model.children[0] as THREE.Mesh;

    if(!ignoreMaterial) modelMesh.material = materials[name];
    
    modelMesh.name = name;
    models.push(modelMesh);
}

let modelToLoad: Object3D;
function loadModelFile() {
    const modelMesh = modelToLoad.children[0] as THREE.Mesh;
    const modelName = modelToLoad.name;

    modelMesh.material = materials[modelName];

    if(objLoader.materials) {
        const materialsArray = Object.values(objLoader.materials.materials);
        materialsArray.reverse();
        modelMesh.material = materialsArray as Material[];
    }


    modelMesh.name = modelName;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    models.push(modelMesh);
}

const loadingManager = new THREE.LoadingManager(loadModelFile);
const objLoader = new OBJLoader(loadingManager);
const mtlLoader = new MTLLoader();

function loadModel(file: string, loadMaterialFromFile = false) {
    function onProgress( xhr: { lengthComputable: any; loaded: number; total: number; } ) {
        if ( xhr.lengthComputable ) {
            const percentComplete = xhr.loaded / xhr.total * 100;
            console.log(percentComplete + "%", "OBJ");
        }
    }

    function onError(error: Error) {
        console.error(error);
    }

    if(loadMaterialFromFile) {
        mtlLoader.setPath(path.join(__dirname, "./assets/models/"))
        mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true, normalizedRGBs: true })
        mtlLoader.load(`${file}.mtl`,
            (materials: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                materials: any; preload: () => void; 
            }) => {

                for(let i = 0; i < materials.materials.length; i++) {
                    const material = materials.materials[i];
                    if(material.name === "leaf") {
                        material.side = THREE.DoubleSide;
                        material.transparent = true;
                        material.opacity = 0.5;
                        material.dithering = true;

                        material.premultipliedAlpha = true;
                    }
                }

                materials.preload();
                objLoader.setMaterials(materials);
                objLoader.setPath(path.join(__dirname, "./assets/models/"))

                objLoader.load(`${file}.obj`,
                    (object: Object3D) => {
                        modelToLoad = object
                        modelToLoad.name = file;
                        //addModel(object, file, true);
                    },
                    onProgress,
                    onError
                );
            },
            onProgress,
            onError
        );
    } else {
        objLoader.setPath(path.join(__dirname, "./assets/models/"))
        objLoader.load(`${file}.obj`,
            (object: Object3D) => {
                modelToLoad = object
                modelToLoad.name = file;
            },
            onProgress,
            onError
        );
    }
}

loadModel("Rock002");
loadModel("Tree", true);


const gui = new GUI();

const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const volumes = [] as VolumeNew[];
for(let z = 0; z < volumesAmount; z++) {
    for(let x = 0; x < volumesAmount; x++) {

        const pos = new Vector3(x, 0, z);

        const volume = new VolumeNew(volumeSize, pos);
        volume.showEdges = true;
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

interface ObjectScattering {
    density: number,
    points: Vector3[],
    intersects: Intersection[]
}

let treeScatter: ObjectScattering = {
    density: 25,
    points: [],
    intersects: []
}

let rockScatter: ObjectScattering = {
    density: 100,
    points: [],
    intersects: []
}

const orbit_controls = new OrbitControls(camera, renderer.domElement)

camera.position.set(volumeSize * 0.5, volumeSize * 1.5, -volumeSize * 1.5);
camera.lookAt(volumeSize * 0.5, volumeSize * 0.5, volumeSize * 0.5);


function createShader(shaderName: string): Shader {
    return {
        vertexShader: fs.readFileSync(path.join(__dirname, `./assets/shader/${shaderName}/vertex.glsl`), 'utf-8'),
        fragmentShader: fs.readFileSync(path.join(__dirname, `./assets/shader/${shaderName}/fragment.glsl`), 'utf-8'),
        glslVersion: THREE.GLSL3
    }
}

function createPBRMaterial(texturePath: string, fileExtension = "png"): PBRMaterial {

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
    position: Vector3 | null;
    rotation: Vector3 | null;
    scale: Vector3 | null;
}

function createInstancedMesh(geometry: THREE.BufferGeometry, material: THREE.Material, scattering: ObjectScatters, matrixSettings: MatrixSettings, randomRot = true): THREE.InstancedMesh {

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
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    for(let i = 0; i < count; i++) {
        const position = positions[i];
        const translation = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);

        // Random rotation in any direction
        const rotation = new THREE.Matrix4();
        if(randomRot)
            rotation.makeRotationY(Math.random() * Math.PI * 2);

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

// Create an axes helper
// const axesHelper = new AxesHelper( 5 );
// scene.add( axesHelper );

const sandMaterial = createPBRMaterial(path.join(__dirname, './assets/textures/Sand'));
const grassMaterial = createPBRMaterial(path.join(__dirname, './assets/textures/Grass'));
const rockTexture = createPBRMaterial(path.join(__dirname, './assets/textures/Rock'));
const snowMaterial = createPBRMaterial(path.join(__dirname, './assets/textures/Snow'));

interface TextureLayer {
    name: string;
    material: ShaderPBR;
    level: number;
    affectedByNormal: boolean;
}
const textureLayers: TextureLayer[] = [
    {
        name: "sand",
        material: sandMaterial,
        level: 1,
        affectedByNormal: false,
    },
    {
        name: "grass",
        material: grassMaterial,
        level: 1,
        affectedByNormal: true,
    },
    {
        name: "rock",
        material: rockTexture,
        level: 1,
        affectedByNormal: false,
    },
    {
        name: "snow",
        material: snowMaterial,
        level: 1,
        affectedByNormal: false,
    }
];


const volumeMaterial = new ShaderMaterial({
    uniforms: {
        materials: {
            value: textureLayers
        },
        yBias: {
            value: volume.yBias
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
        },
        viewPosition: {
            value: camera.position
        }
    },
    ...createShader("triplanar")
})

// For each volume in volumes, merge the geometries
const volumeGeos = [] as BufferGeometry[];
for(const volume of volumes) {
    const geo = volume.geometry;
    volumeGeos.push(geo);
}

const mergedGeo = Volume.mergeGeometries(volumeGeos);
const mesh = new THREE.Mesh(mergedGeo || volume.geometry, volumeMaterial);
mesh.position.set(0,0,0);
mesh.receiveShadow = true;
mesh.castShadow = true;
scene.add(mesh);

rockScatter = updateScatter(rockScatter, mesh);
treeScatter = updateScatter(treeScatter, mesh);

function updateScatter(scattering: ObjectScattering, mesh: THREE.Mesh): ObjectScattering {
    scattering.points = distributeObjects(scattering.density);
    return scattering = {
        ...scattering,
        ...snapToTerrain(mesh, scattering.points)
    }
}

function updateMesh(loadedModels: THREE.Mesh[]) {
    for(const volume of volumes) {
        volume.update("noise");
        volume.update("geometry");
    }

    mesh.geometry.dispose();
    mesh.geometry = volume.geometry;

    const volumeGeos = volumes.map(volume => volume.geometry);
    const mergedGeo = Volume.mergeGeometries(volumeGeos);
    mesh.geometry = mergedGeo;

    rockScatter = updateScatter(rockScatter, mesh);
    treeScatter = updateScatter(treeScatter, mesh);

    const radians = (degrees: number) => degrees * Math.PI / 180;
    const degrees = (radians: number) => radians * 180 / Math.PI;

    loadedModels.forEach(model => {
        const mat = model.material as Material;
        model.geometry.name = model.name;

        const scatterProperties = model.name.includes('Rock') ? rockScatter : treeScatter;
            
        const instancedModel = createInstancedMesh(model.geometry, mat, scatterProperties, {
            position: null,
            rotation: null,
            scale: model.name.includes('Rock') ? new Vector3(5, 5, 5) : new Vector3(1, 1, 1)
        }, model.name.includes('Rock'));

        for(const child of scene.children) {
            if(child.name === model.name) {
                scene.remove(child);
            }
        }

        instancedModel.name = model.name;
        scene.add(instancedModel);
    });
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
    updateMesh(models);
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
        'density': rockScatter.density,
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

            updateMesh(models);
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
                        rockScatter.density = params.objects.density;
                        rockScatter.points = distributeObjects(rockScatter.density);
                        break;
                                
                    default:
                        break;
                }
            }
            
            updateMesh(models);
        },
        regenerate: () => {
            let newSeed = new Date().getTime();
            newSeed %= 65536;
            ob.seed = newSeed;

            for(const volume of volumes) {
                volume.seed = newSeed;
                volume.noiseConfigs = params.configs;
                volume.noiseSeed = Volume.createSeed(volume.seed);
            }

            updateMesh(models);
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
            noiseConfigsFolder.add(params.actions, 'addConfig').onFinishChange(() => updateMesh(models)).name("Add");
            noiseConfigsFolder.add(params.actions, 'removeConfig').onFinishChange(() => updateMesh(models)).name("Remove");
        }
    }
}

// Render the render target to the screen
const planeGeo = new THREE.PlaneGeometry(2, 2);
const planeMaterial = new MeshBasicMaterial({
    map: depthRenderer.texture,
    side: THREE.DoubleSide
});
const planeMesh = new THREE.Mesh(planeGeo, planeMaterial);
scene.add(planeMesh);

// noiseFolder.add(params, 'noiseScale', 0.01, 10).onChange(() => params.actions.update("noiseScale")).name('Noise Scale');

const volumeFolder = gui.addFolder('Volume Settings');
volumeFolder.add(params, 'densityThreshold', -1, 1).onChange(() => params.actions.update("densityThreshold")).name('Density Threshold');
volumeFolder.add(params, 'yBias', 0, volumeSize).onChange(() => params.actions.update("yBias")).name('Y Bias');
volumeFolder.add(params, 'showEdges').onChange(() => params.actions.update("showEdges")).name('Show Edges');
volumeFolder.add(params, 'edgeSharpness', 0, 100).onChange(() => params.actions.update("edgeSharpness")).name('Edge Sharpness');

const textureLayersFolder = volumeFolder.addFolder('Texture Layers');
for(let i = 0; i < textureLayers.length; i++) {
    const layer = textureLayers[i];
    const layerName = layer.name.charAt(0).toUpperCase() + layer.name.slice(1);
    const layerFolder = textureLayersFolder.addFolder(layerName);
    layerFolder.add(layer, 'level', 0, 1).name('Maximum');
    layerFolder.add(layer, 'affectedByNormal')
}


volumeFolder.add(params.actions, 'regenerate').name('Regenerate');

const objectFolder = gui.addFolder('Object Settings');
objectFolder.add(params.objects, 'density', 0, 100).onChange(() => params.actions.update("density")).name('Density');

params.actions.createConfigFolders()

//#endregion

let frameCount = 0;

// Camera orbit around center of the volume
function animate() {
    requestAnimationFrame(animate)
    render()
    stats.update();
}

function render() {
    if(frameCount == 28) updateMesh(models);
    orbit_controls.update(clock.getDelta());
    
    renderer.render(scene, camera)

    frameCount++;
}

// Event Listeners
window.addEventListener('resize', onWindowResize, false)

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}
animate();