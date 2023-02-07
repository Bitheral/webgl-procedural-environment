out vec2 uvs;
out vec3 normals;

void main() {
    uvs = uv;
    normals = normal;

    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}