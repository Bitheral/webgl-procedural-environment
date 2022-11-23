
import THREE = require('three');
import { Vector3 } from "three";
import { Cube } from "./Cube";

export class Volume {
    private position: Vector3;
    private size: number;
    private volume: Cube[][][] = [];

    // Create a constuctor that takes a size, and a position of 0,0,0
    public constructor(size: number) {
        this.position = new Vector3(0, 0, 0);
        this.size = size;
        this.createVolume();
    }

    // Create a function that creates a volume of cubes
    public createVolume(): Cube[][][] {
        for (let x = 0; x < this.size; x++) {
            this.volume[x] = [];
            for (let y = 0; y < this.size; y++) {
                this.volume[x][y] = [];
                for (let z = 0; z < this.size; z++) {
                    const cube = new Cube(new Vector3(x, y, z), this.position);
                    this.volume[x][y][z] = cube;
                }
            }
        }
        return this.volume;
    }

    public addToScene(scene: THREE.Scene): void {
        // For each cube in the volume, create a cube
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const cube = this.volume[x][y][z];
                    const cubeVerts = cube.createCube();
                    for(let i = 0; i < cubeVerts.length; i++) {
                        // Create a box for each vert
                        const vert = cubeVerts[i];
                        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                        const cube = new THREE.Mesh(geometry, material);
                        cube.position.set(vert.x, vert.y, vert.z);
                        scene.add(cube);
                    }
                }
            }
        }
    }

}