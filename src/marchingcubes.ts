import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3, Vector4 } from "three";
import { createNoise3D, createNoise2D } from "simplex-noise";
import { seed, perlin2, perlin3 } from "perlin.js"
import alea from "alea";

import { edgeTable, triTable, cornerIndexFromEdge } from "./lookup.json";

const EPSILON = 0.00001;

export function VertexInterp3(isoLevel: number, vertex1: Vector4, vertex2: Vector4): Vector3 {
    if (Math.abs(isoLevel - vertex1.w) < EPSILON) {
        return new Vector3(vertex1.x, vertex1.y, vertex1.z);
    }
    if (Math.abs(isoLevel - vertex2.w) < EPSILON) {
        return new Vector3(vertex2.x, vertex2.y, vertex2.z);
    }
    if (Math.abs(vertex1.w - vertex2.w) < EPSILON) {
        return new Vector3(vertex1.x, vertex1.y, vertex1.z);
    }

    let mu = (isoLevel - vertex1.w) / (vertex2.w - vertex1.w);
    let x = vertex1.x + mu * (vertex2.x - vertex1.x);
    let y = vertex1.y + mu * (vertex2.y - vertex1.y);
    let z = vertex1.z + mu * (vertex2.z - vertex1.z);

    return new Vector3(x, y, z);
}

export function VertexInterp4(isoLevel: number, vertex1: Vector4, vertex2: Vector4): Vector4 {
    if (Math.abs(isoLevel - vertex1.w) < EPSILON) {
        return new Vector4(vertex1.x, vertex1.y, vertex1.z, vertex1.w);
    }
    if (Math.abs(isoLevel - vertex2.w) < EPSILON) {
        return new Vector4(vertex2.x, vertex2.y, vertex2.z, vertex2.w);
    }
    if (Math.abs(vertex1.w - vertex2.w) < EPSILON) {
        return new Vector4(vertex1.x, vertex1.y, vertex1.z, vertex1.w);
    }

    let mu = (isoLevel - vertex1.w) / (vertex2.w - vertex1.w);
    let x = vertex1.x + mu * (vertex2.x - vertex1.x);
    let y = vertex1.y + mu * (vertex2.y - vertex1.y);
    let z = vertex1.z + mu * (vertex2.z - vertex1.z);
    let w = vertex1.w + mu * (vertex2.w - vertex1.w);

    return new Vector4(x, y, z, w);
}

///////////////////////////////////////


export interface NoiseData {
    offset: Vector3;
    scale: number;
    octaves: number;
    persistence: number;
    lacunarity: number;
}

export const NoiseData = {
    offset: new Vector3(0, 0, 0),
    scale: 1,
    octaves: 1,
    persistence: 1,
    lacunarity: 1,
};

export class Noise {
    public noise: any = {
        perlin: {
            "2D": perlin2,
            "3D": perlin3,
        },
        simplex: {
            "2D": createNoise2D(),
            "3D": createNoise3D(),
        }
    }

    public seed = 0;
    private noiseType = "perlin";

    constructor(_seed: number) {
        this.seed = _seed;
    }

    public static createSeed(_seed = 1) {
        // If the seed is 0, or more than 65536, then get the modulus of the seed
        while (_seed === 0 || _seed > 65536) {
            _seed = _seed % 65536;
        }

        seed(_seed);
    }

    public setType(type: string) {
        switch (type) {
            case "perlin":
            case "simplex":
                this.noiseType = type;
                break;
            default:
                console.error("Noise type not found");
                console.warn("Defaulting to perlin noise");
                this.noiseType = "perlin";
                break;
        }
    }

    public generate3D(position: Vector3, noiseData: NoiseData): number {
        Noise.createSeed(this.seed * (position.x + position.y + position.z));
        let noise = this.noise[this.noiseType]["3D"];

        if (noiseData.scale <= 0) {
            noiseData.scale = 0.0001;
        }

        let coord = position.clone().multiplyScalar(noiseData.scale).add(noiseData.offset);
        let perlinValue = noise(coord.x, coord.y, coord.z);

        return perlinValue;
    }

    public generate3DFBM(position: Vector3, noiseData: NoiseData, offset: Vector3): number {
        let noise = this.noise[this.noiseType]["3D"];

        let maxPossibleHeight = 0;
        let amplitude = 1;
        let frequency = 1;

        for (let i = 0; i < noiseData.octaves; i++) {
            maxPossibleHeight += amplitude;
            amplitude *= noiseData.persistence;
        }

        if (noiseData.scale <= 0) {
            noiseData.scale = 0.0001;
        }

        // Get max and min values of Float
        let max = Number.MAX_VALUE;
        let min = Number.MIN_VALUE;

        let noiseHeight = 0;
        amplitude = 1;
        frequency = 1;

        for (let i = 0; i < noiseData.octaves; i++) {
            let coord = position.clone().multiplyScalar(noiseData.scale * frequency).add(offset).add(noiseData.offset);

            let perlinValue = noise(coord.x, coord.y, coord.z);
            noiseHeight += perlinValue * amplitude;

            amplitude *= noiseData.persistence;
            frequency *= noiseData.lacunarity;
        }

        if (noiseHeight > max) {
            max = noiseHeight;
        } else if (noiseHeight < min) {
            min = noiseHeight;
        }

        return noiseHeight;
    }
}


//////////////////////////////////////////////////




export interface MeshData {
    vertices: number[];
    normals: number[];
}

export class Volume {
    private static cubeCorners: Vector3[] = [
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(1, 0, 1),
        new Vector3(0, 0, 1),
        new Vector3(0, 1, 0),
        new Vector3(1, 1, 0),
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 1)
    ]

    public size: number = 1;
    public position: Vector3 = new Vector3(0, 0, 0);

    public vertices: number[] = [];
    public uvs: number[] = [];
    public densities: number[] = [];

    public geometry: BufferGeometry = new BufferGeometry();

    public showEdges: boolean = true;
    public edgeSharpness: number = 1.1;
    public show: boolean = true;

    public noiseOffset: Vector3 = new Vector3(0, 0, 0);

    public noiseScale: number = 4;
    public densityThreshold: number = 1;
    public yBias: number = 0;

    public seed: number = 0;
    public noiseSeed: number = 0;
    public pNoiseSeed = Volume.createSeed(this.seed);

    public ySize: number = 0;

    public customNoise: Noise = new Noise(this.seed);

    public noiseConfigs: NoiseData[] = [];

    public noise: any = {
        perlin: {
            "2D": perlin2,
            "3D": perlin3,
        },
        simplex: {
            "2D": createNoise2D(),
            "3D": createNoise3D(),
        }
    }

    public static createSeed(_seed: number) {
        return seed(_seed);
    }

    constructor(size: number, position: Vector3, noiseOffset: Vector3 = new Vector3(0, 0, 0)) {
        this.size = size;
        this.position = position;
        this.noiseOffset = noiseOffset;

        this.ySize = this.size / 2;
        this.yBias = this.ySize;

        this.noiseConfigs.push({
            'scale': 1,
            'octaves': 4,
            'persistence': 0.5,
            'lacunarity': 2,
            'offset': new Vector3(0, 0, 0)
        });
    }

    public update(key: string): void {
        if (key.toLowerCase() == "geometry") {
            this.geometry.dispose();
            this.March();
            this.geometry.computeVertexNormals();
        }

        // if(key.toLowerCase() == "noise") {
        //     for(let i = 0; i < this.noiseConfigs.length; i++) {
        //         this.noiseConfigs[i].offset = this.position.clone().multiplyScalar(this.noiseConfigs[i].scale);

        //     }
        // }
    }

    public March() {
        this.noiseSeed = seed(this.seed);
        this.vertices = [];
        this.densities = [];
        this.uvs = [];

        // let frontNeighbour = this.neighbours.front;
        // let backNeighbour = this.neighbours.back;
        // let leftNeighbour = this.neighbours.left;
        // let rightNeighbour = this.neighbours.right;

        // let frontLeftNeighbour = this.neighbours.frontLeft;
        // let frontRightNeighbour = this.neighbours.frontRight;
        // let backLeftNeighbour = this.neighbours.backLeft;
        // let backRightNeighbour = this.neighbours.backRight;

        let zSize = true ? this.size - 1 : this.size;
        let xSize = true ? this.size - 1 : this.size;

        // For each cube in the grid
        for (let z = 0; z < zSize; z++) {
            for (let y = 0; y < this.size - 1; y++) {
                for (let x = 0; x < xSize; x++) {

                    let cubeindex: number = 0;
                    let cubePosition = new Vector3(x, y, z);
                    let corners: Vector4[] = [];
                    let cornerDensity: number[] = [];

                    Volume.cubeCorners.forEach((corner, i) => {
                        let cornerPos = corner.clone();
                        cornerPos.add(cubePosition);

                        let noise = 0;

                        // For each noise config, add the noise
                        for (let config of this.noiseConfigs) {
                            let cPosition = cornerPos.clone();
                            cPosition.z -= zSize * 0.5;
                            cPosition.x -= xSize * 0.5;
                            cPosition.divideScalar(this.getScale());

                            const volumePosition = this.position.clone().multiplyScalar(config.scale);
                            let newNoise = this.customNoise.generate3DFBM(
                                cPosition,
                                config,
                                volumePosition
                            );

                            noise += (newNoise * (1 / this.noiseConfigs.length));
                        }

                        // let noise = this.customNoise.generate3D(, this.noiseScale, 1, 1, 1, this.noiseOffset);

                        noise = (noise + 1) / 2;

                        let heightBias = (cornerPos.y / this.getScale());
                        let density = heightBias * (cornerPos.y / this.yBias || 0.001) - noise;

                        cornerDensity[i] = density;
                        corners[i] = new Vector4(cornerPos.x, cornerPos.y, cornerPos.z, density);
                    });


                    for (let i = 0; i < 8; i++) {
                        const corner = corners[i];


                        // If the corner at at the top of the volume,
                        // the corner.w will be 1, otherwise it will be 0

                        const cornerIsAtTop = corner.y == this.getScale() - 1;
                        const cornerIsAtBottom = corner.y == 0;
                        const cornerIsAtRight = corner.x == this.getScale() - 1;
                        const cornerIsAtLeft = corner.x == 0;
                        const cornerIsAtFront = corner.z == this.getScale() - 1;
                        const cornerIsAtBack = corner.z == 0;

                        const showFrontFace = (cornerIsAtFront && true) && z == this.size - 2;
                        const showBackFace = (cornerIsAtBack && true) && z == 0;
                        const showRightFace = (cornerIsAtRight && true) && x == this.size - 2;
                        const showLeftFace = (cornerIsAtLeft && true) && x == 0;


                        if (showFrontFace) corner.w = (this.showEdges) ? this.edgeSharpness : cornerDensity[i];
                        if (showBackFace) corner.w = (this.showEdges) ? this.edgeSharpness : cornerDensity[i];
                        if (showRightFace) corner.w = (this.showEdges) ? this.edgeSharpness : cornerDensity[i];
                        if (showLeftFace) corner.w = (this.showEdges) ? this.edgeSharpness : cornerDensity[i];

                        if (cornerIsAtBottom) corner.w = (this.showEdges) ? this.edgeSharpness : cornerDensity[i];
                        if (cornerIsAtTop) corner.w = (this.showEdges) ? this.edgeSharpness : cornerDensity[i];

                        if (corner.w <= this.getDensityThreshold()) {
                            cubeindex |= 1 << i;
                        }
                    }

                    /* Cube is entirely in/out of the surface */
                    if (edgeTable[cubeindex] == 0) {
                        continue;
                    }


                    const triangluation = triTable[cubeindex];
                    triangluation.forEach(edge => {
                        if (edge == -1) return;

                        let indexA = cornerIndexFromEdge[edge][0];
                        let indexB = cornerIndexFromEdge[edge][1];

                        let cornerA = corners[indexA];
                        let cornerB = corners[indexB];

                        let vert = VertexInterp3(this.getDensityThreshold(), cornerA, cornerB);

                        // Get the vertex
                        // Don't interpolate
                        // let vert = cornerA.clone();
                        // vert.add(cornerB);
                        // vert.divideScalar(2);

                        this.vertices.push(vert.x, vert.y, vert.z);

                        // Create UV  from vert
                        let uvVert = vert.clone().divideScalar(this.getScale())
                        this.uvs.push(uvVert.x, uvVert.z);
                    });
                }
            }
        }

        // Create the geometry
        this.geometry = new BufferGeometry();
        this.geometry.setAttribute('position', new Float32BufferAttribute(this.vertices, 3));
        this.geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));

        this.geometry.computeVertexNormals();
        this.geometry.translate(this.position.x * this.size, this.position.y * this.size, this.position.z * this.size);
    }

    public getDensityThreshold(): number {
        return this.densityThreshold;
    }

    public getHeightmap(scale = 1): { point: Vector3, normal: Vector3 }[] {
        const heightMap = [] as { point: Vector3, normal: Vector3 }[];
        const heightMapper = new Raycaster();
        const mesh = new Mesh(this.geometry, new MeshBasicMaterial({ color: 0x000000 }));

        // Calculate the size based on the scale
        // Where 1 is the size of the volume
        // Where 2 is half the size of the volume


        for (let x = Number(this.showEdges); x < this.size - Number(this.showEdges); x += scale) {
            for (let z = Number(this.showEdges); z < this.size - Number(this.showEdges); z += scale) {
                const point = new Vector3(x, this.size * 2, z);
                heightMapper.set(point, new Vector3(0, -1, 0));
                const intersects = heightMapper.intersectObject(mesh);
                if (intersects.length === 0) {
                    continue;
                }
                else {
                    heightMap.push({
                        point: intersects[0].point,
                        normal: intersects[0].face?.normal.clone().normalize() || new Vector3(0, 1, 0)
                    });
                }
            }
        }

        return heightMap;
    }

    public getNoiseScale(): number {
        return this.noiseScale;
    }

    public getScale(): number {
        return this.size;
    }

    public getGeometry(): BufferGeometry {
        return this.geometry;
    }

    public isShowingEdges(): boolean {
        return this.showEdges;
    }

}