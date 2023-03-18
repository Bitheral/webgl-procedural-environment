out vec3 vertex;
out vec2 uvs;
out vec3 normals;
out vec3 worldPosition;

out mat4 instMat;
out mat4 modMat;

struct Material {
    sampler2D albedo;
    sampler2D normal;
    sampler2D roughness;
    sampler2D displacement;
    sampler2D ao;
};

struct SampledMaterial {
    vec4 albedo;
    vec4 normal;
    vec4 roughness;
    vec4 displacement;
    vec4 ao;
};

SampledMaterial sampleMaterial(Material material, vec2 uv) {
    SampledMaterial sampledMaterial;
    sampledMaterial.albedo = texture2D(material.albedo, uv);
    sampledMaterial.normal = texture2D(material.normal, uv);
    sampledMaterial.roughness = texture2D(material.roughness, uv);
    sampledMaterial.displacement = texture2D(material.displacement, uv);
    sampledMaterial.ao = texture2D(material.ao, uv);
    return sampledMaterial;
}

uniform Material mat;

void main() {
    vertex = position;
    uvs = uv;
    normals = normal;
    instMat = instanceMatrix;
    modMat = modelMatrix;

    SampledMaterial outMat = sampleMaterial(mat, uvs);

    // displacement
    vec3 newPosition = vertex + normals * outMat.displacement.r * 0.01;

    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(newPosition, 1.0);
}