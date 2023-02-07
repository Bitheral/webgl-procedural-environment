varying vec3 vertex; 
varying vec2 uvs;
varying vec3 normals;
varying vec3 worldPosition;

attribute vec3 volumePosition;

void main() {
    vertex = position;
    uvs = uv;
    normals = normal;

    // volumePosition is the position of the volume in world space, so we need to add it to the vertex position
    // to get the world position of the vertex
    worldPosition = (modelMatrix * vec4(position + volumePosition, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + volumePosition, 1.0);


    // Calculate world position of vertex
    // worldPosition = (modelMatrix * vec4(position + volumePosition, 1.0)).xyz;

    // gl_Position = projectionMatrix * modelViewMatrix * vec4(position + volumePosition, 1.0);
}