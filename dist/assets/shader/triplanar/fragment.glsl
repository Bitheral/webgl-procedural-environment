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

struct Light {
    vec3 position;
    vec3 direction;
};


in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;

in mat4 instanceMat;
in mat4 modelMat;

uniform Material xAx;

uniform Material top;
uniform Material bottom;

uniform Material zAx;

uniform float volumeScale;
uniform float noiseScale;

uniform Light worldLight;

varying vec3 volumeDensityColor;

SampledMaterial sampleMaterial(Material material, vec2 uv) {
    SampledMaterial sampledMaterial;
    sampledMaterial.albedo = texture2D(material.albedo, uv);
    sampledMaterial.normal = texture2D(material.normal, uv);
    sampledMaterial.roughness = texture2D(material.roughness, uv);
    sampledMaterial.displacement = texture2D(material.displacement, uv);
    sampledMaterial.ao = texture2D(material.ao, uv);
    return sampledMaterial;
}

vec4 calculateLight(SampledMaterial material) {   
    vec3 color = vec3(0);
    vec3 light = vec3(volumeScale * 0.5, volumeScale * 1.5, volumeScale * 0.5);

    // Include ambient light
    color += material.albedo.rgb * 0.99;

    // Include normal map
    vec3 normal = normalize(material.normal.rgb * 2.0 - 1.0) * 0.75;

    // Include normal light
    vec3 lightDir = normalize(light - vertex);
    float diff = max(dot(normal, lightDir), 0.0);
    color += material.albedo.rgb * diff;

    // Include ambient occlusion
    color *= material.ao.rgb;

    return vec4(color, 1.0);
}

out vec4 final;

void main() {

    int DEBUG = 0;

    SampledMaterial frontM;
    SampledMaterial topM;
    SampledMaterial sideM;

    vec2 uv_front = vec2(-worldPosition.z, -worldPosition.y) / volumeScale;
    vec2 uv_back = (worldPosition.yz / volumeScale);

    vec2 uv_left = -worldPosition.xy / volumeScale;
    vec2 uv_right = (worldPosition.yz / volumeScale);

    vec2 uv_top = worldPosition.xz / volumeScale;
    vec2 uv_bottom = (worldPosition.zx / volumeScale);

    // Based on the normals, we can determine which side of the cube we are on
    // and sample the correct material
    if (normals.x <= 0.5) {
        sideM = sampleMaterial(xAx, uv_left);
    } else {
        sideM = sampleMaterial(xAx, uv_right);
    }

    if (normals.z <= 0.5) {
        frontM = sampleMaterial(zAx, uv_back);
    } else {
        frontM = sampleMaterial(zAx, uv_front);
    }

    if (normals.y <= 0.5) {
        topM = sampleMaterial(bottom, uv_bottom);
    } else {
        topM = sampleMaterial(top, uv_top);
    }

    vec3 weights = abs(normals) / noiseScale;
    weights = weights / (weights.x + weights.y + weights.z);

    vec4 f = calculateLight(frontM);
    vec4 t = calculateLight(topM);
    vec4 s = calculateLight(sideM);

    vec4 color = DEBUG == 1 ? vec4(weights, 1.0) : (f * weights.x) + (t * weights.y) + (s * weights.z);
    
    final = vec4(1.0) * color;
}