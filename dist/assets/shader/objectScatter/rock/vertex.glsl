out vec3 vertex;
out vec2 uvs;
out vec3 normals;
out vec3 worldPosition;

out mat4 instMat;
out mat4 modMat;

void main() {
    vertex = position;
    uvs = uv;
    normals = normal;
    instMat = instanceMatrix;
    modMat = modelMatrix;

    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}