struct Light {
    vec3 position;
    vec3 direction;
};

struct MaterialLayer {
    float index;
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

uniform sampler2D albedo;
uniform sampler2D ao;
uniform sampler2D normal;

uniform float volumeScale;
uniform float noiseScale;
uniform float yBias;

varying vec3 volumeDensityColor;

// SampledMaterial sampleMaterial(Material material, vec2 uv, vec2 scale, vec2 offset) {

//     // Corrected UVs
//     uv = uv * scale + offset;

//     SampledMaterial sampledMaterial;
//     sampledMaterial.albedo = texture2D(material.albedo, uv);
//     sampledMaterial.normal = texture2D(material.normal, uv);
//     sampledMaterial.ao = texture2D(material.ao, uv);

//     return sampledMaterial;
// }

vec4 calculateLight(vec4 a, vec4 ao, vec4 normal) {   
    vec4 color = vec4(0);

    // Include ambient light
    color += a * 0.5;

    // Include normal map
    vec3 normal_m = normalize(normal.xyz * 2.0 - 1.0) * 0.5;

    // Include normal light
    vec3 lightDir = normalize(worldLight.direction);
    float diff = max(dot(normal_m, lightDir), 0.0);
    color += a * diff;

    // Include ambient occlusion
    color *= ao;

    return color;
}

out vec4 final;

void main() {

    // Based on the y position, we can determine which material layer we are in
    float y = worldPosition.y / volumeScale;


    // Get the material layer that the current y position is in
    // Provide a default material layer
    int layer = -1;
    int lastLayer = -1;
    // Loop through all the material layers
    for (int i = 0; i < 4; i++) {
        // If the current y position is in the current material layer
        if (y < materials[i].level) {
            // Set the current material layer to the current material layer
            layer = i;
            break;
        }
        lastLayer = i -1;
    }

    // If the layer is still -1, then use the last layer
    if (layer == -1) {
        layer = lastLayer;
    }

    int DEBUG = 0;

    vec4 frontM;
    vec4 topM;
    vec4 sideM;

    vec2 uv_front = -(worldPosition.zy) / volumeScale;
    vec2 uv_back = (worldPosition.yz / volumeScale);

    vec2 uv_left = -worldPosition.xy / volumeScale;
    vec2 uv_right = (worldPosition.yz / volumeScale);

    vec2 uv_top = worldPosition.xz / volumeScale;
    vec2 uv_bottom = (worldPosition.zx / volumeScale);

    float xOffset = float(layer % 2) * 0.5;
    float yOffset = float(layer / 2) * 0.5; 
    // vec2 offset = vec2(xOffset, yOffset);
    vec2 offset = vec2(xOffset, yOffset);
    vec2 scale = vec2(0.5, 0.5);

    vec2 uv_s = normals.x <= 0.5 ? uv_left * -scale : uv_right * -scale;
    vec2 uv_f = normals.z <= 0.5 ? uv_front * -scale : uv_back * -scale;
    vec2 uv_t = normals.y <= 0.5 ? uv_bottom * scale : uv_top * scale;

    vec4 a_t = texture2D(albedo, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    vec4 a_s = texture2D(albedo, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0.01, scale.y + 0.01));
    vec4 a_f = texture2D(albedo, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0.01, scale.y + 0.01));

    vec4 n_t = texture2D(normal, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    vec4 n_s = texture2D(normal, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0.01, scale.y + 0.01));
    vec4 n_f = texture2D(normal, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0.01, scale.y + 0.01));

    vec4 ao_t = texture2D(ao, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    vec4 ao_s = texture2D(ao, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0.01, scale.y + 0.01));
    vec4 ao_f = texture2D(ao, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0.01, scale.y + 0.01));

    vec3 weights = abs(normals) / noiseScale;
    weights = weights / (weights.x + weights.y + weights.z);

    vec4 f = calculateLight(a_f, ao_f, n_f);
    vec4 t = calculateLight(a_t, ao_t, n_t);
    vec4 s = calculateLight(a_s, ao_s, n_s);

    vec4 color = DEBUG == 1 ? vec4(weights, 1.0) : (f * weights.x) + (t * weights.y) + (s * weights.z);
    
    final = vec4(1.0) * color;
}