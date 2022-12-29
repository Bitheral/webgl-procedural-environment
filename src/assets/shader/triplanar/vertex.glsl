varying vec3 vertex; 
varying vec2 uvs;
varying vec3 normals;
varying vec3 worldPosition;

void main() {
    vertex = position;
    uvs = uv;
    normals = normal;

    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);

    // Calculate world position of vertex
    worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewPosition;
}