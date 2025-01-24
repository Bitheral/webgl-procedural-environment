import * as THREE from 'three';
import fragmentShader from './fragment.glsl?raw';
import vertexShader from './vertex.glsl?raw';

export default {
    vertexShader,
    fragmentShader,
    glslVersion: THREE.GLSL3
}