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


uniform Material top;
uniform Material side;

uniform float volumeScale;
uniform float noiseScale;

uniform Light worldLight;

varying vec3 vertex;
varying vec2 uvs;
varying vec3 normals;
varying vec3 worldPosition;

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
    vec3 color = material.albedo.rgb;
    return vec4(color * material.ao.xyz, 1.0);

}

out vec4 final;

void main() {

    int DEBUG = 0;

    SampledMaterial frontM;
    SampledMaterial topM;
    SampledMaterial sideM;

    vec2 uv_front = worldPosition.zy / volumeScale;
    vec2 uv_back = (worldPosition.yz / volumeScale);

    vec2 uv_left = worldPosition.xy / volumeScale;
    vec2 uv_right = (worldPosition.yz / volumeScale);

    vec2 uv_top = worldPosition.xz / volumeScale;
    vec2 uv_bottom = (worldPosition.zx / volumeScale);

    // Based on the normals, we can determine which side of the cube we are on
    // and sample the correct material
    if (normals.x <= 0.5) {
        sideM = sampleMaterial(side, uv_left);
    } else {
        sideM = sampleMaterial(side, uv_right);
    }

    if (normals.z <= 0.5) {
        frontM = sampleMaterial(side, uv_back);
    } else {
        frontM = sampleMaterial(side, uv_front);
    }

    if (normals.y <= 0.5) {
        topM = sampleMaterial(side, uv_bottom);
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