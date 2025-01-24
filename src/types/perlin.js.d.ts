declare module 'perlin.js' {
  /**
   * Seed the noise functions. Only 65536 different seeds are supported. Use a float between 0 and 1 or an integer from 1 to 65536.
   * @param seed - The seed value.
   * @returns The seed value.
   */
  export function seed(seed: number): number;

  /**
   * 2D Simplex noise function
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Noise value between -1 and 1
   */
  export function simplex2(x: number, y: number): number;

  /**
   * 3D Simplex noise function
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @returns Noise value between -1 and 1
   */
  export function simplex3(x: number, y: number, z: number): number;

  /**
    * 2D Perlin noise function
    * @param x - X coordinate
    * @param y - Y coordinate
    * @returns Noise value between -1 and 1
    */
  export function perlin2(x: number, y: number): number;

  /**
   * 3D Perlin noise function
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param z - Z coordinate
   * @returns Noise value between -1 and 1
   */
  export function perlin3(x: number, y: number, z: number): number;


  // Add other exports as needed based on perlin.js documentation
}