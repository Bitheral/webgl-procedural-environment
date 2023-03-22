// This file is required by the index.html file and will
// be executed in the renderer process for that window.

// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.

// Use preload.js to selectively enable features
// needed in the renderer process.

// Get threejs
import { Vector3, DirectionalLight, PerspectiveCamera, ShaderMaterial, Texture, AxesHelper, Intersection, Vector, Vector2, MeshBasicMaterial, BufferGeometry, LoadingManager, Object3D, Material, TextureLoader } from 'three';

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
    ao: THREE.Texture;
}
const MaterialUniform = (material: PBRMaterial) => {
    const result: ShaderPBR = {
        albedo: material.albedo,
        normal: material.normal,
        ao: material.ao
    }
    return result;
}

const Rock002 = createPBRMaterial(path.join(__dirname, './assets/textures/Rock002'), 'jpg');
const Terrain = createPBRMaterial(path.join(__dirname, './assets/textures/Terrain'));

// Example Three.js code
const scene = new THREE.Scene();
const light = new DirectionalLight(0xffffff, 1);
light.position.set(volumeSize * 0.5, volumeSize, volumeSize * 0.5);
scene.add(light);

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const clock = new THREE.Clock();
clock.start();

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
                    direction: light.getWorldDirection(new Vector3(volumeSize * 0.5, 0, volumeSize * 0.5)),
                }
            },
            viewPosition: {
                value: camera.position
            }
        },
        ...createShader("objectScatter/rock")
    }),
} as { [key: string]: THREE.Material };

const waterNormal = new TextureLoader().load(path.join(__dirname, './assets/textures/Water/normal.jpg'));
waterNormal.wrapS = THREE.RepeatWrapping;
waterNormal.wrapT = THREE.RepeatWrapping;
waterNormal.repeat.set(1, 1);
const waterMaterial = new ShaderMaterial({
    uniforms: {
        time: {
            value: clock.getElapsedTime()
        },
        normalMap: {
            value: waterNormal
        },
        lightPosition: {
            value: light.position
        },
        viewPosition: {
            value: camera.position
        }
    },
    ...createShader("water")
})

waterMaterial.transparent = true;
waterMaterial.opacity = 0.5;
waterMaterial.side = THREE.DoubleSide;


// Mark as deprecated
function addModel(model: Object3D, name: string, ignoreMaterial = false) {
    const modelMesh = model.children[0] as THREE.Mesh;

    if(!ignoreMaterial) modelMesh.material = materials[name];
    
    modelMesh.name = name;
    models.push(modelMesh);
}

let modelToLoad: Object3D;
function loadModelFile(model: Object3D, name: string, material: Material | Material[] = null) {
    console.log("Loading model: " + name + "");
    const modelMesh = model.children[0] as THREE.Mesh;
    const modelName = name;
    
    if(material !== null) {
        console.log(material)
        if(Array.isArray(material)) {
            modelMesh.material = material;
        }
        else {
            let finalMaterials = Object.values(material);
            if(name == "Tree") {            
                // Get index of key "leaf"
                const leafM = finalMaterials[Object.keys(material).indexOf("leaf")];
                const bark = finalMaterials[Object.keys(material).indexOf("bark")];

                finalMaterials = [
                    leafM,
                    bark
                ]
            }

            modelMesh.material = finalMaterials;
        }
    }
    else modelMesh.material = materials[modelName];

    modelMesh.name = modelName;
    models.push(modelMesh);
}
const objLoader = new OBJLoader();
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

                        loadModelFile(object, file, materials.materials);
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

                loadModelFile(object, file);
                //addModel(object, file, true);
            },
            onProgress,
            onError
        );
    }
}

loadModel("Tree", true);
loadModel("Rock002");


const gui = new GUI();
const renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let volumeSeed = new Date().getTime();
volumeSeed %= 65536;


const volumes = [] as VolumeNew[];
for(let z = 0; z < volumesAmount; z++) {
    for(let x = 0; x < volumesAmount; x++) {

        const pos = new Vector3(x, 0, z);
        const volume = new VolumeNew(volumeSize, pos);
        volume.densityThreshold = -0.2;
        volume.showEdges = true;
        volume.edgeSharpness = 100;
        volume.seed = volumeSeed;
        volume.noiseSeed = Volume.createSeed(volumeSeed);

        volume.noiseConfigs = [
            {
                'scale': 2.5,
                'octaves': 5,
                'persistence': 0.5,
                'lacunarity': 2,
                'offset': new Vector3(0, 0, 0)
            }
        ]

        volume.March();

        volumes.push(volume);
    }
}
const volume = volumes[0];

if(volumes.length > 1) {
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
}

interface ObjectScattering {
    enabled: boolean,
    density: number,
    scale: number,
    points: Vector3[],
    intersects: Intersection[],
    normals: Vector3[]
}

let treeScatter: ObjectScattering = {
    enabled: true,
    density: 25,
    scale: 1,
    points: [],
    intersects: [],
    normals: []
}

let rockScatter: ObjectScattering = {
    enabled: true,
    density: 100,
    scale: 4,
    points: [],
    intersects: [],
    normals: []
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
        ao: null
    }

    for(const file of fs.readdirSync(texturePath)) {
        if(!file.endsWith('.' + fileExtension)) {
            throw new Error(`File ${file} is not a ${fileExtension} file`);
        }

        if(!['albedo', 'normal', 'ao'].includes(file.split('.')[0])) {
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
            case 'ao':
                pbrMaterial.ao = texture;
                break;
        }
    }

    return pbrMaterial
}

interface MatrixSettings {
    position: Vector3 | null;
    rotation: Vector3 | null;
    scale: Vector3 | null;
}

function createInstancedMesh(geometry: THREE.BufferGeometry, material: THREE.Material, scattering: ObjectScattering, matrixSettings: MatrixSettings, randomRot = true): THREE.InstancedMesh {
    
    const count = scattering.points.length;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    for(let i = 0; i < count; i++) {
        const position = scattering.points[i];
        const translation = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
        
        // Add a small offset between -1.5 and 1.5 on the x and z axis
        const offset = new THREE.Matrix4().makeTranslation(
            (Math.random() - 0.5) * 3,
            0,
            (Math.random() - 0.5) * 3
        );

        const matrix = new THREE.Matrix4();
        matrix.multiply(translation);
        matrix.multiply(offset);

        if(randomRot) {
            const rotation = new THREE.Matrix4().makeRotationY(Math.random() * Math.PI * 2);
            matrix.multiply(rotation);
        }

        // Apply matrix settings
        if(matrixSettings.position) {
            const positionMatrix = new THREE.Matrix4().makeTranslation(
                matrixSettings.position.x,
                matrixSettings.position.y,
                matrixSettings.position.z
            );
            matrix.multiply(positionMatrix);
        }

        if(matrixSettings.rotation) {
            const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(
                new THREE.Euler(
                    matrixSettings.rotation.x,
                    matrixSettings.rotation.y,
                    matrixSettings.rotation.z
                )
            );
            matrix.multiply(rotationMatrix);
        }

        // Randomly scale the object between 0.75 and 1.25
        const scaleRandom = Math.random() * 0.5 + 0.75;
        const scale = new THREE.Matrix4().makeScale(
            scaleRandom,
            scaleRandom,
            scaleRandom
        );

        matrix.multiply(scale);
        if(matrixSettings.scale) {
            const scaleMatrix = new THREE.Matrix4().makeScale(
                matrixSettings.scale.x,
                matrixSettings.scale.y,
                matrixSettings.scale.z
            );
            matrix.multiply(scaleMatrix);
        }

        mesh.setMatrixAt(i, matrix);
    }

    return mesh;


    // // Valid points are the points that have their intersects.face.normal.normalized().y > 0;
    // const validPoints = [];


    // for(let i = 0; i < scattering.intersects.length; i++) {
    //     const normal = scattering.intersects[i].face.normal.clone().normalize();

    //     if(normal.y >= 0.9) {
    //         validPoints.push(scattering.points[i]);
    //     }
    // }

    // const count = validPoints.length;
    // const positions = validPoints;

    // const mesh = new THREE.InstancedMesh(geometry, material, count);
    // mesh.castShadow = true;
    // mesh.receiveShadow = true;

    // for(let i = 0; i < count; i++) {
    //     const position = positions[i];
    //     const translation = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);

    //     // Random rotation in any direction
    //     const rotation = new THREE.Matrix4();
    //     if(randomRot)
    //         rotation.makeRotationY(Math.random() * Math.PI * 2);

    //     const scale = new THREE.Matrix4().makeScale(1, 1, 1);

    //     const matrixP = new THREE.Matrix4();

    //     if(matrixSettings.position) {
    //         matrixP.makeTranslation(matrixSettings.position.x, matrixSettings.position.y, matrixSettings.position.z);
    //     }

    //     const matrixR = new THREE.Matrix4();

    //     if(matrixSettings.rotation) {
    //         matrixR.makeRotationFromEuler(new THREE.Euler(matrixSettings.rotation.x, matrixSettings.rotation.y, matrixSettings.rotation.z));
    //     }

    //     const matrixS = new THREE.Matrix4();

    //     if(matrixSettings.scale) {
    //         matrixS.makeScale(matrixSettings.scale.x, matrixSettings.scale.y, matrixSettings.scale.z);
    //     }


    //     translation.multiply(matrixP);
    //     rotation.multiply(matrixR);
    //     scale.multiply(matrixS);



    //     const matrix = new THREE.Matrix4();
    //     matrix.multiply(translation);
    //     matrix.multiply(rotation);
    //     matrix.multiply(scale);

    //     mesh.setMatrixAt(i, matrix);
    // }


    // return mesh;
}

renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( 0x000000, 0);
document.getElementById('webgl').appendChild(renderer.domElement);

orbit_controls.target = new Vector3(0,0,0).addScalar(volumeSize).divideScalar(2);

interface TextureLayer {
    name: string;
    index: number;
    level: number;
    affectedByNormal: boolean;
}
const textureLayers: TextureLayer[] = [
    {
        name: "sand",
        index: 0,
        level: 0.2,
        affectedByNormal: false,
    },
    {
        name: "grass",
        index: 1,
        level: 0.4,
        affectedByNormal: false,
    },
    {
        name: "rock",
        index: 2,
        level: 0.7,
        affectedByNormal: false,
    },
    {
        name: "snow",
        index: 3,
        level: 1,
        affectedByNormal: false,
    }
];


const volumeMaterial = new ShaderMaterial({
    uniforms: {
        materials: {
            value: textureLayers
        },
        material: {
            value: MaterialUniform(Terrain)
        },
        debug: {
            value: 0
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
        lightPosition: {
            value: light.position,
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

rockScatter = updateScatter(rockScatter);
treeScatter = updateScatter(treeScatter);

const treeNoise = new THREE.Group();
treeNoise.name = "treeNoise";


function updateScatter(scattering: ObjectScattering): ObjectScattering {

    const data = {
        offset: new Vector3(0,0,0),
        scale: scattering.scale,
        octaves: 2,
        persistence: 0.75,
        lacunarity: 2,
    }

    const points = [] as Vector3[];
    const normals = [] as Vector3[];
    for(let i = 0; i < volumes.length; i++) {
        const volume = volumes[i];
        const heightMapData = volume.getHeightmap(data.scale);
        // Move all points from volume's heightmap to points
        for(let j = 0; j < heightMapData.length; j++) {
            const data = heightMapData[j];
            
            if(data.normal.y >= 0.9) {
                points.push(data.point);
                normals.push(data.normal);
            }
        }
        
    }

    // For each point in points, check if it's y value is greater than random
    // If it is, add it to the scattering.points array
    const newPoints = [] as Vector3[];
    const newNormals = [] as Vector3[];

    // Create a threejs group to hold the noise
    const noiseGroup = new THREE.Group();
    noiseGroup.name = "heightmapNoise";

    // CHeck if the noise group already exists
    const existingNoiseGroup = scene.getObjectByName("heightmapNoise");
    if(existingNoiseGroup) {
        scene.remove(existingNoiseGroup);
    }
    
    const noise = new Noise(volume.seed * (Math.random() * 65536));
    noise.setType("simplex");

    for(const point of points) {
        // If the points x and z values are 0 or volumeSize, skip it
        if(point.x < 2 || point.x === volumeSize || point.z < 2 || point.z === volumeSize) continue;
        const random = Math.random();

        const noiseValue = noise.generate3DFBM(point, data, new Vector3(0,0,0));

        if(noiseValue > random && scattering.density >= (noiseValue * 100)) {
            newPoints.push(point);
            newNormals.push(normals[points.indexOf(point)]);
        }

        // Create a cube to represent the noise
        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(noiseValue, noiseValue, noiseValue)
            })
        );
        cube.position.copy(point);
        noiseGroup.add(cube);
    }
    //scene.add(noiseGroup);

    return {
        ...scattering,
        points: newPoints,
        normals: newNormals,
    }

    // const newPoints = points.filter(point => point.y > random);


    // scattering.points = distributeObjects(scattering.density);
    // return scattering = {
    //     ...scattering,
    //     ...snapToTerrain(mesh, scattering.points)
    // }
}
const ob = {
    seed: volume.seed,
    autoUpdate: false,
}

function updateMesh(loadedModels: THREE.Mesh[], forced = false) {
    if(!ob.autoUpdate && !forced) return;

    for(const volume of volumes) {
        volume.update("noise");
        volume.update("geometry");
    }

    mesh.geometry.dispose();
    mesh.geometry = volume.geometry;

    const volumeGeos = volumes.map(volume => volume.geometry);
    const mergedGeo = Volume.mergeGeometries(volumeGeos);
    mesh.geometry = mergedGeo;

    rockScatter = updateScatter(rockScatter);
    treeScatter = updateScatter(treeScatter);

    const radians = (degrees: number) => degrees * Math.PI / 180;
    const degrees = (radians: number) => radians * 180 / Math.PI;

    loadedModels.forEach(model => {
        const mat = model.material as Material;
        model.geometry.name = model.name;

        const scatterProperties = model.name.includes('Rock') ? rockScatter : treeScatter;
        
        // Check if the scene already has an instanced mesh with the same name
        const existingInstancedMesh = scene.getObjectByName(model.name);
        if(existingInstancedMesh)
            scene.remove(existingInstancedMesh);

        
        if(scatterProperties.enabled) {
            const instancedModel = createInstancedMesh(model.geometry, mat, scatterProperties, {
                position: null,
                rotation: null,
                scale: model.name.includes('Rock') ? new Vector3(5, 5, 5) : new Vector3(1, 1, 1)
            }, model.name.includes('Rock'));

            instancedModel.name = model.name;
            scene.add(instancedModel);
        }
    });
}


//#region GUI
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
            'scale': 2.5,
            'octaves': 5,
            'persistence': 0.5,
            'lacunarity': 2,
            'offset': new Vector3(0,0,0),
            'open': false
        },
    ],
    'regenerateAuto': false,
    'densityThreshold': volume.densityThreshold,
    'yBias': volume.yBias,
    'showEdges': volume.showEdges,
    'edgeSharpness': volume.edgeSharpness,
    'waterLevel': 0,

    objects: [{
        name: 'Rock',
        density: rockScatter.density,
        scale: rockScatter.scale,
        enabled: rockScatter.enabled,
    },
    {
        name: 'Tree',
        density: treeScatter.density,
        scale: treeScatter.scale,
        enabled: treeScatter.enabled,
    }],

    actions: {
        addConfig: () => {
            params.configs.push({
                'scale': 2.5,
                'octaves': 5,
                'persistence': 0.5,
                'lacunarity': 2,
                'offset': new Vector3(0, 0, 0),
                open: false
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
        update(key: string, value: any = null) {
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
                        updateWater()
                        break;
                    case 'edgeSharpness':
                        volume.edgeSharpness = params.edgeSharpness;
                        break;

                    case 'density':
                        for(const obj of params.objects) {
                            if(obj.name === 'Rock') {
                                rockScatter.density = obj.density;
                                obj.density = rockScatter.density;
                            } else if(obj.name === 'Tree') {
                                treeScatter.density = obj.density;
                                obj.density = treeScatter.density;
                            }
                        }
                        break;

                    case 'scale':
                        for(const obj of params.objects) {
                            if(obj.name === 'Rock') {
                                rockScatter.scale = obj.scale;
                                obj.scale = rockScatter.scale;
                            } else if(obj.name === 'Tree') {
                                treeScatter.scale = obj.scale;
                                obj.scale = treeScatter.scale;
                            }
                        }
                        break;

                    case 'enabled':
                        for(const obj of params.objects) {
                            if(obj.name === 'Rock') {
                                rockScatter.enabled = obj.enabled;
                                obj.enabled = rockScatter.enabled;
                            } else if(obj.name === 'Tree') {
                                treeScatter.enabled = obj.enabled;
                                obj.enabled = treeScatter.enabled;
                            }
                        }
                        break;
                                
                    default:
                        break;
                }
            }
            
            updateMesh(models);
        },
        regenerate: () => {
            // let newSeed = new Date().getTime();
            // newSeed %= 65536;
            // ob.seed = newSeed;

            for(const volume of volumes) {
                // volume.seed = newSeed;
                volume.noiseConfigs = params.configs;
                // volume.noiseSeed = Volume.createSeed(volume.seed);
            }

            updateMesh(models, true);
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
function updateWater() {
    // Create a box named "Water" and add it to the scene
    const volSize = volumeSize - Number(volume.showEdges);
    if(scene.getObjectByName("Water")) {
        // Change the geometry of the water
        const water = scene.getObjectByName("Water") as THREE.Mesh;
        water.geometry.dispose();
        water.geometry = new THREE.BoxGeometry(1, 1, 1, volumeSize, params.waterLevel, volumeSize);
        water.scale.set(volSize, params.waterLevel, volSize);

        // Update the position so that the water's bottom is at y = 0
        water.position.set(volSize * 0.5, params.waterLevel * 0.5, volSize * 0.5)
    } else {
        // Create the water
        const water = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1, volumeSize, params.waterLevel, volumeSize),
            waterMaterial
        );
        water.scale.set(volSize, params.waterLevel, volSize);
        water.position.set(volSize * 0.5, params.waterLevel * 0.5, volSize * 0.5)
        water.name = "Water";
        scene.add(water);
    }
}
updateWater();

// noiseFolder.add(params, 'noiseScale', 0.01, 10).onChange(() => params.actions.update("noiseScale")).name('Noise Scale');

const volumeFolder = gui.addFolder('Terrain');
volumeFolder.add(params, 'densityThreshold', -1, 1).onChange(() => params.actions.update("densityThreshold")).name('Density Threshold');
volumeFolder.add(params, 'yBias', 0, volumeSize).onChange(() => params.actions.update("yBias")).name('Elevation limit');
volumeFolder.add(params, 'showEdges').onChange(() => params.actions.update("showEdges")).name('Show Edges');

const textureLayersFolder = volumeFolder.addFolder('Texture Layers');
for(let i = 0; i < textureLayers.length; i++) {
    const layer = textureLayers[i];
    const layerName = layer.name.charAt(0).toUpperCase() + layer.name.slice(1);
    const layerFolder = textureLayersFolder.addFolder(layerName);
    layerFolder.add(layer, 'level', 0, 1).name('Level');
    if(layerName !== "Rock") layerFolder.add(layer, 'affectedByNormal').name('Show on edge');
}

const envFolder = gui.addFolder('Environment');
const objectsFolder = envFolder.addFolder('Scatttering');
for(const object of params.objects) {
    const objectFolder = objectsFolder.addFolder(object.name);
    objectFolder.add(object, 'enabled').name('Enabled').onChange(() => params.actions.update("enabled", object.name));
    objectFolder.add(object, 'density', 0, 100).onChange(() => params.actions.update("density", object.name)).name('Density');
    objectFolder.add(object, 'scale', 0.1, 4).name('Scale').onChange(() => params.actions.update("scale", object.name));
}

const waterFolder = envFolder.addFolder('Water');
waterFolder.add(scene.children.find(child => child.name == 'Water'), 'visible').name('Show Water');
waterFolder.add(params, 'waterLevel', 0, volumeSize).onChange(() => updateWater()).name('Water Level');

gui.add(ob, 'autoUpdate').name('Auto Update');
const regenButton = gui.add(params.actions, 'regenerate')
regenButton.name('Regenerate');


params.actions.createConfigFolders()

//#endregion

let frameCount = 0;

// Camera orbit around center of the volume
function animate() {
    requestAnimationFrame(animate);
    render()
    stats.update();
}

function render() {
    if(frameCount == 28) updateMesh(models, true);
    waterMaterial.uniforms.time.value = clock.getElapsedTime();
    waterMaterial.uniforms.viewPosition.value = camera.position;
    waterMaterial.uniformsNeedUpdate = true;

    volumeMaterial.uniforms.viewPosition.value = camera.position;
    volumeMaterial.uniformsNeedUpdate = true;

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