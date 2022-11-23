import { Vector3, Vector4 } from "three";
import { perlinVector3 } from "../../libs/noise";

export class Cube {

    // Where the cube is in the grid (local space)
    private volumePosition: Vector3;
    private gridPosition: Vector3;

    private cubeVertPositions: Vector3[] = [
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(1, 1, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 1),
        new Vector3(1, 0, 1),
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 1)
    ];

    public constructor(position: Vector3, worldPosition: Vector3) { 
        this.volumePosition = position;
        this.gridPosition = worldPosition;
    }

    public createCube(): Vector4[] {
        const cube: Vector4[] = [];
        for (let i = 0; i < this.cubeVertPositions.length; i++) {
            const vert = this.cubeVertPositions[i];
            const worldVert = vert.clone().add(this.gridPosition);

            const value = perlinVector3(worldVert);
            cube.push(new Vector4(worldVert.x, worldVert.y, worldVert.z, value));
        }
        return cube;
    }


}