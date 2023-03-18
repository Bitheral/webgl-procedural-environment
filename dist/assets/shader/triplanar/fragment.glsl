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

struct MaterialLayer {
    Material material;
    float level;
    bool affectedByNormal;
};

uniform Light worldLight;
uniform vec3 viewPosition;


in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;

in mat4 instanceMat;
in mat4 modelMat;

uniform MaterialLayer[4] materials;

uniform float volumeScale;
uniform float noiseScale;
uniform float yBias;

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

    // Include ambient light
    color += material.albedo.rgb * 0.5;

    // Include normal map
    vec3 normal = normalize(material.normal.rgb * 2.0 - 1.0) * 0.5;

    // Include normal light
    vec3 lightDir = normalize(worldLight.direction);
    float diff = max(dot(normal, lightDir), 0.0);
    color += material.albedo.rgb * diff;

    // Include specular light
    // vec3 viewDir = normalize(viewPosition - vertex);
    // vec3 reflectDir = reflect(-lightDir, normal);
    // float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    // color += vec3(1.0) * spec;

    // Include ambient occlusion
    color *= material.ao.rgb;

    return vec4(color, 1.0);
}

out vec4 final;

void main() {

    // Based on the y position, we can determine which material layer we are in
    float y = worldPosition.y / volumeScale;


    // Get the material layer that the current y position is in
    // Provide a default material layer
    int layer = -1;
    // Loop through all the material layers
    for (int i = 0; i < 4; i++) {
        // If the current y position is in the current material layer
        if (y < materials[i].level) {
            // Set the current material layer to the current material layer
            layer = i;
            break;
        }
    }

    // If layer is still -1, then the current y position is not in any material layer
    // Set the current material layer to the last material layer
    if (layer == -1) {
        discard;
    }

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
        if(!materials[layer].affectedByNormal) sideM = sampleMaterial(materials[layer].material, uv_left);
        else sideM = sampleMaterial(materials[2].material, uv_left);
    } else {
        if(!materials[layer].affectedByNormal) sideM = sampleMaterial(materials[layer].material, uv_right);
        else sideM = sampleMaterial(materials[2].material, uv_right);
    }

    if (normals.z <= 0.5) {
        if(!materials[layer].affectedByNormal) frontM = sampleMaterial(materials[layer].material, uv_back);
        else frontM = sampleMaterial(materials[2].material, uv_back);
    } else {
        if(!materials[layer].affectedByNormal) frontM = sampleMaterial(materials[layer].material, uv_front);
        else frontM = sampleMaterial(materials[2].material, uv_front);
    }

    if (normals.y <= 0.5) {
        topM = sampleMaterial(materials[2].material, uv_bottom);
    } else {
        topM = sampleMaterial(materials[layer].material, uv_top);
    }

    vec3 weights = abs(normals) / noiseScale;
    weights = weights / (weights.x + weights.y + weights.z);

    vec4 f = calculateLight(frontM);
    vec4 t = calculateLight(topM);
    vec4 s = calculateLight(sideM);

    vec4 color = DEBUG == 1 ? vec4(weights, 1.0) : (f * weights.x) + (t * weights.y) + (s * weights.z);
    
    final = vec4(1.0) * color;
}