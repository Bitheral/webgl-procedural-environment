import * as THREE from 'three';
import perlinNoise3d from "perlin-noise-3d";

class Cube {
    static cornerPoints = [
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(-0.5, -0.5, 0.5),
        new THREE.Vector3(0.5, -0.5, 0.5),
        new THREE.Vector3(0.5, -0.5, -0.5),
        new THREE.Vector3(-0.5, 0.5, -0.5),
        new THREE.Vector3(-0.5, 0.5, 0.5),
        new THREE.Vector3(0.5, 0.5, 0.5),
        new THREE.Vector3(0.5, 0.5, -0.5)
    ];

    constructor(cubePosition) {
        this.corners = new Array(8);
        this.position = cubePosition;

        for (let i = 0; i < this.corners.length; i++) {

            let cornerPosition = this.position + Cube.cornerPoints[i];

            const noise = new perlinNoise3d();
            let posNoise = noise.get(cornerPosition.x, cornerPosition.y, cornerPosition.z);
            
            this.corners[i] = new THREE.Vector4(cornerPosition.x, cornerPosition.y, cornerPosition.z, posNoise);
        }
    }

    VertexInterpolation(a, b, aV, bV) {
            const iV = aV / (aV - bV);
            return a.clone().lerp(b, iV);
    }

    buildMesh() {
        let verticies = [];
        let faces = [];

        let geometry = new THREE.Geometry();
        
        let tableIndex = 0;
        for (let i = 0; i < this.corners.length; i++) {
            let value = this.corners[i].w;
            if (value > 0.5) {
                tableIndex |= 1 << i;
            }
        }

        let triangulation = window.Triangulation[tableIndex];
        triangulation.forEach(edgeIndex => {
            if (edgeIndex === -1) return;

            const indexA = window.CornerIndexFromEdge[0][edgeIndex];
            const indexB = window.CornerIndexFromEdge[1][edgeIndex];

            const vertexPosition = VertexInterpolation(cornersIndex[indexA], cornersIndex[indexB], corners[indexA].w, corners[indexB].w);

            verticies.push(vertexPosition);
            faces.push(verticies.length - 1);
        });

        geometry.vertices = verticies;
        geometry.faces = faces;

        return geometry;
    }
}

class MarchingCubes {

    constructor() {
        this.gridSize = new THREE.Vector3(0, 0, 0);
        this.grid = [];
    }

    generatesGrid(gridSize) {
        this.gridSize = new THREE.Vector3(gridSize);
        this.grid = new Array(this.gridSize.x * this.gridSize.y * this.gridSize.z);

        for(let z = 0; z < gridSize.z; z++) {
            for(let y = 0; y < gridSize.y; y++) {
                for(let x = 0; x < gridSize.x; x++) {
                    let grid_index = x + y * gridSize.x + z * gridSize.x * gridSize.y;
                    this.grid[grid_index] = new Cube(new THREE.Vector3(x, y, z));
                }
            }
        }
    }

    March() {
        let geometry = new THREE.Geometry();

        for(let z = 0; z < this.gridSize.z; z++) {
            for(let y = 0; y < this.gridSize.y; y++) {
                for(let x = 0; x < this.gridSize.x; x++) {
                    let grid_index = x + y * this.gridSize.x + z * this.gridSize.x * this.gridSize.y
                    let cube = this.grid[grid_index];

                    geometry.merge(cube.buildMesh());
                }
            }
        }

        return geometry;
    }
}