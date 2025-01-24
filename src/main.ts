import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import Stats from 'stats.js';
import { Volume } from './marchingcubes';

// import rockShaderSource from './assets/shader/objectScatter/rock';
import triplanarShaderSource from './assets/shader/triplanar';
// import waterShaderSource from './assets/shader/water';

const stats = new Stats()
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);


interface PBRMaterial {
  albedo: THREE.Texture | null;
  normal: THREE.Texture | null;
  ao: THREE.Texture | null;
}

interface ShaderPBR {
  albedo: THREE.Texture | null;
  normal: THREE.Texture | null;
  ao: THREE.Texture | null;
}

interface TextureLayer {
  name: string;
  index: number;
  level: number;
  affectedByNormal: boolean;
}


const MaterialUniform = (material: PBRMaterial) => {
  const result: ShaderPBR = {
    albedo: material.albedo,
    normal: material.normal,
    ao: material.ao
  }
  return result;
}

const createPBRMaterial = (textureName: string, fileExtension = "png"): PBRMaterial => {

  const pbrMaterial: PBRMaterial = {
    albedo: null,
    normal: null,
    ao: null
  }

  // Make use of the public directory to load the textures
  const loader = new THREE.TextureLoader();
  const albedo = loader.load(`/textures/${textureName}/albedo.${fileExtension}`);
  const normal = loader.load(`/textures/${textureName}/normal.${fileExtension}`);
  const ao = loader.load(`/textures/${textureName}/ao.${fileExtension}`);

  // If loaded, assign the textures to the material
  pbrMaterial.albedo = albedo;
  pbrMaterial.normal = normal;
  pbrMaterial.ao = ao;

  return pbrMaterial
}

////
// Consts

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

const volumeSize = 32;
const volumesAmount = 1;
// const volumeSeed = new Date().getTime() % 65536;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, document.body);
const light = new THREE.DirectionalLight(0xffffff, 1);
const volume = new Volume(volumeSize, new THREE.Vector3, new THREE.Vector3);

// const RockMaterial = createPBRMaterial('rock', 'jpg');
const TerrainMaterial = createPBRMaterial('terrain', 'png');
// const WaterMaterial = createPBRMaterial('water', 'jpg');

const ob = {
  seed: volume.seed,
  autoUpdate: false,
}

const params = {
  'configs': [
    {
      'scale': 2.5,
      'octaves': 5,
      'persistence': 0.5,
      'lacunarity': 2,
      'offset': new THREE.Vector3(0, 0, 0),
      'open': false
    },
  ],
  'regenerateAuto': false,
  'densityThreshold': volume.densityThreshold,
  'yBias': volume.yBias,
  'showEdges': volume.showEdges,
  'edgeSharpness': volume.edgeSharpness,
  'waterLevel': 0,

  // objects: [{
  //   name: 'Rock',
  //   density: rockScatter.density,
  //   scale: rockScatter.scale,
  //   enabled: rockScatter.enabled,
  // },
  // {
  //   name: 'Tree',
  //   density: treeScatter.density,
  //   scale: treeScatter.scale,
  //   enabled: treeScatter.enabled,
  // }],

  actions: {
    addConfig: () => {
      params.configs.push({
        'scale': 2.5,
        'octaves': 5,
        'persistence': 0.5,
        'lacunarity': 2,
        'offset': new THREE.Vector3(0, 0, 0),
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
      if (params.configs.length <= 1) return;

      params.configs.pop();
      noiseFolder.removeFolder(noiseConfigsFolder);
      noiseConfigsFolder = noiseFolder.addFolder('Noise Configs');
      noiseConfigsFolder.open();

      params.actions.createConfigFolders();

      params.actions.regenerate();
    },
    updateConfig(index: number) {
      const config = params.configs[index];
      volume.noiseConfigs[index] = config;
      // for (const volume of volumes) {
      //   volume.noiseConfigs[index] = config;
      // }

      updateMesh([]);
    },
    update(key: string, value: any = null) {
      console.log("Updating", key, value);
      switch (key) {
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
          // updateWater()
          break;
        case 'edgeSharpness':
          volume.edgeSharpness = params.edgeSharpness;
          break;

        case 'density':
          // for (const obj of params.objects) {
          //   if (obj.name === 'Rock') {
          //     rockScatter.density = obj.density;
          //     obj.density = rockScatter.density;
          //   } else if (obj.name === 'Tree') {
          //     treeScatter.density = obj.density;
          //     obj.density = treeScatter.density;
          //   }
          // }
          break;

        case 'scale':
          // for (const obj of params.objects) {
          //   if (obj.name === 'Rock') {
          //     rockScatter.scale = obj.scale;
          //     obj.scale = rockScatter.scale;
          //   } else if (obj.name === 'Tree') {
          //     treeScatter.scale = obj.scale;
          //     obj.scale = treeScatter.scale;
          //   }
          // }
          break;

        case 'enabled':
          // for (const obj of params.objects) {
          //   if (obj.name === 'Rock') {
          //     rockScatter.enabled = obj.enabled;
          //     obj.enabled = rockScatter.enabled;
          //   } else if (obj.name === 'Tree') {
          //     treeScatter.enabled = obj.enabled;
          //     obj.enabled = treeScatter.enabled;
          //   }
          // }
          break;

        default:
          break;
      }

      updateMesh([]);
    },
    regenerate: () => {
      // for (const volume of volumes) {
      //   volume.noiseConfigs = params.configs;
      // }

      volume.noiseConfigs = params.configs;

      updateMesh([], true);
    },
    createConfigFolders: () => {
      for (let i = 0; i < params.configs.length; i++) {
        const config = params.configs[i];
        const configFolder = noiseConfigsFolder.addFolder(`Config ${i + 1}`);

        if (config.open) {
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
      noiseConfigsFolder.add(params.actions, 'addConfig').onFinishChange(() => updateMesh([])).name("Add");
      noiseConfigsFolder.add(params.actions, 'removeConfig').onFinishChange(() => updateMesh([])).name("Remove");
    }
  }
}


const gui = new GUI();

const volumeFolder = gui.addFolder('Terrain');
volumeFolder.add(params, 'densityThreshold', -1, 1).onChange(params.actions.update.bind(params.actions, 'densityThreshold')).name('Density Threshold');
volumeFolder.add(params, 'yBias', 0, volumeSize).onChange(params.actions.update.bind(params.actions, 'yBias')).name('Elevation limit');
volumeFolder.add(params, 'showEdges').onChange(params.actions.update.bind(params.actions, 'showEdges')).name('Show Edges');

const textureLayersFolder = volumeFolder.addFolder('Texture Layers');
for (let i = 0; i < textureLayers.length; i++) {
  const layer = textureLayers[i];
  const layerName = layer.name.charAt(0).toUpperCase() + layer.name.slice(1);
  const layerFolder = textureLayersFolder.addFolder(layerName);
  layerFolder.add(layer, 'level', 0, 1).name('Level');
  if (layerName !== "Rock") layerFolder.add(layer, 'affectedByNormal').name('Show on edge');
}


const noiseFolder = volumeFolder.addFolder('Noise Settings');

noiseFolder.add(ob, 'seed', -65566, 65536).onChange(() => {
  volume.seed = ob.seed;
  volume.noiseSeed = Volume.createSeed(volume.seed);
  updateMesh([]);
}).name('Noise Seed');
let noiseConfigsFolder = noiseFolder.addFolder('Noise Configs');

// const environmentFolder = gui.addFolder('Environment');

// const waterFolder = environmentFolder.addFolder('Water');

gui.add(ob, 'autoUpdate').name('Auto Update');
gui.add(params.actions, 'regenerate').name('Regenerate');

params.actions.createConfigFolders()

////
// Shaders
// const rockShader = new THREE.ShaderMaterial({
//   uniforms: {
//     mat: {
//       value: MaterialUniform(RockMaterial)
//     },
//     volumeScale: {
//       value: volumeSize * volumesAmount
//     },
//     worldLight: {
//       value: {
//         position: light.position,
//         direction: light.getWorldDirection(new THREE.Vector3(volumeSize * 0.5, 0, volumeSize * 0.5)),
//       }
//     },
//     viewPosition: {
//       value: camera.position
//     }
//   },
//   ...rockShaderSource
// });

const volumeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    materials: {
      value: textureLayers
    },
    material: {
      value: MaterialUniform(TerrainMaterial)
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
  ...triplanarShaderSource
})

// Materials

const scene = new THREE.Scene();
// waterFolder.add(scene.children.find(child => child.name == 'Water'), 'visible').name('Show Water');
// waterFolder.add(params, 'waterLevel', 0, volumeSize).onChange(() => updateWater()).name('Water Level');

camera.lookAt(volumeSize * 0.5, volumeSize * 0.5, volumeSize * 0.5);

controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.enablePan = false;
controls.minDistance = 1;
controls.maxDistance = 75;
camera.position.set(0, 0, 60);


controls.target = new THREE.Vector3().addScalar(volumeSize).divideScalar(2);

light.position.set(volumeSize * 0.5, volumeSize, volumeSize * 0.5);

// volume.densityThreshold = -0.2;
// volume.showEdges = true;
// volume.edgeSharpness = 100;
// volume.seed = volumeSeed;
// volume.noiseSeed = Volume.createSeed(volumeSeed);
// volume.noiseConfigs = [
//   {
//     'scale': 2.5,
//     'octaves': 5,
//     'persistence': 0.5,
//     'lacunarity': 2,
//     'offset': new THREE.Vector3(0, 0, 0)
//   }
// ]

volume.March();

let geometry = volume.geometry;
let material = volumeMaterial;
let cube = new THREE.Mesh(geometry, material);

function updateMesh(loadedModels: THREE.Mesh[], forced = false) {
  if (!ob.autoUpdate && !forced) return;
  loadedModels.forEach(model => { model.geometry.dispose(); });

  // for (const volume of volumes) {
  //   volume.update("noise");
  //   volume.update("geometry");
  // }

  volume.update("noise");
  volume.update("geometry");

  cube.geometry.dispose();
  cube.geometry = volume.geometry;

  // const volumeGeos = volumes.map(volume => volume.geometry);
  // const mergedGeo = Volume.mergeGeometries(volumeGeos);
  // cube.geometry = mergedGeo;

  // rockScatter = updateScatter(rockScatter);
  // treeScatter = updateScatter(treeScatter);

  // const radians = (degrees: number) => degrees * Math.PI / 180;
  // const degrees = (radians: number) => radians * 180 / Math.PI;

  // loadedModels.forEach(model => {
  //   const mat = model.material as THREE.Material;
  //   model.geometry.name = model.name;

  //   // const scatterProperties = model.name.includes('Rock') ? rockScatter : treeScatter;

  //   // Check if the scene already has an instanced mesh with the same name
  //   const existingInstancedMesh = scene.getObjectByName(model.name);
  //   if (existingInstancedMesh)
  //     scene.remove(existingInstancedMesh);


  //   // if (scatterProperties.enabled) {
  //   //   const instancedModel = createInstancedMesh(model.geometry, mat, scatterProperties, {
  //   //     position: null,
  //   //     rotation: null,
  //   //     scale: model.name.includes('Rock') ? new Vector3(5, 5, 5) : new Vector3(1, 1, 1)
  //   //   }, model.name.includes('Rock'));

  //   //   instancedModel.name = model.name;
  //   //   scene.add(instancedModel);
  //   // }
  // });
}



scene.add(cube);
scene.add(light);

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true
});
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);

const webglElement = document.getElementById('webgl');
if (webglElement) {
  webglElement.appendChild(renderer.domElement);
} else {
  console.error('Element with id "webgl" not found.');
}


function animate() {
  volumeMaterial.uniforms.viewPosition.value = camera.position;
  volumeMaterial.uniformsNeedUpdate = true;


  renderer.render(scene, camera);
  controls.update();
}
renderer.setAnimationLoop(animate);