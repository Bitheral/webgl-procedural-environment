in vec2 resolution;

out vec3 vertex; 
out vec2 uvs;
out vec3 normals;
out vec3 worldPosition;
out vec3 screenPosition;

void main() {
    vertex = position;
    uvs = uv;
    normals = normal;

    // volumePosition is the position of the volume in world space, so we need to add it to the vertex position
    // to get the world position of the vertex
    worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    // Get the screen position of the vertex
    screenPosition = (projectionMatrix * modelViewMatrix * vec4(position, 1.0)).xyz;
    


    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}