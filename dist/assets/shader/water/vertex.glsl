uniform float time;

out vec3 vertex; 
out vec2 uvs;
out vec3 normals;
out vec3 worldPosition;
out vec3 fromLightPosition;
out vec3 toCameraPosition;

uniform vec3 lightPosition;
uniform vec3 viewPosition;

void main() {
    vertex = position;
    uvs = uv;
    normals = normal;

    // volumePosition is the position of the volume in world space, so we need to add it to the vertex position
    // to get the world position of the vertex
    worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    
    fromLightPosition = lightPosition - worldPosition;
    toCameraPosition = viewPosition - worldPosition;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    
}