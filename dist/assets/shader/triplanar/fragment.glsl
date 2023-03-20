struct MaterialLayer {
    float index;
    float level;
    bool affectedByNormal;
};

struct Material {
    sampler2D albedo;
    sampler2D normal;
    sampler2D ao;
};

struct SampledMaterial {
    vec4 albedo;
    vec4 normal;
    vec4 ao;
};


uniform vec3 viewPosition;


in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;
in vec3 fromLightPosition;
in vec3 toCameraVector;

in mat4 instanceMat;
in mat4 modelMat;

uniform MaterialLayer[4] materials;
uniform Material material;

uniform sampler2D albedo;
uniform sampler2D ao;
uniform sampler2D normal;

uniform float volumeScale;
uniform float noiseScale;
uniform float yBias;

uniform int debug;

varying vec3 volumeDensityColor;

SampledMaterial sampleMaterial(Material material, vec2 uv) {
    SampledMaterial sampledMaterial;
    sampledMaterial.albedo = texture2D(material.albedo, uv);
    sampledMaterial.normal = texture2D(material.normal, uv);
    sampledMaterial.ao = texture2D(material.ao, uv);

    return sampledMaterial;
}

vec4 calculateLight(SampledMaterial sampleMaterial) {   
    vec4 color = vec4(0);

    // // Include ambient light
    // color = mix(color, sampleMaterial.albedo, 0.5);

    // // Include normal light
    // vec3 viewVector = normalize(toCameraVector);
    // vec3 texNormal = vec3(sampleMaterial.normal.r * 2.0 - 1.0, sampleMaterial.normal.b, sampleMaterial.normal.g * 2.0 - 1.0);
    // texNormal = normalize(texNormal);

    // vec3 reflectedLight = reflect(normalize(fromLightPosition), texNormal);
    // float specular = pow(max(dot(reflectedLight, viewVector), 0.0), 0.0);
    // vec3 specularHighlight = vec3(1.0, 1.0, 1.0) * specular * 0.5;

    // color = mix(color, vec4(specularHighlight, 1.0), 0.5);

    // // Include ambient occlusion
    // color *= sampleMaterial.ao;


    // Apply a directional light
    vec3 lightDirection = normalize(vec3(0.0, 1.0, 0.0));
    vec3 lightColor = vec3(1.0, 1.0, 1.0);

    // Calculate the light intensity
    float lightIntensity = max(dot((normals + sampleMaterial.normal.rgb) * 0.5, lightDirection), 0.0);

    // Calculate the ambient light
    vec3 ambient = sampleMaterial.albedo.rgb * lightColor * 0.1;

    // Calculate the diffuse light
    vec3 diffuse = sampleMaterial.albedo.rgb * lightColor * lightIntensity;

    // Calculate the specular light
    vec3 viewVector = normalize(toCameraVector);
    vec3 texNormal = vec3(sampleMaterial.normal.r * 2.0 - 1.0, sampleMaterial.normal.b, sampleMaterial.normal.g * 2.0 - 1.0);
    texNormal = normalize(texNormal);

    // vec3 reflectedLight = reflect(normalize(-fromLightPosition), texNormal);
    // float specular = pow(max(dot(reflectedLight, viewVector), 0.0), 0.0);
    // vec3 specularHighlight = vec3(1.0, 1.0, 1.0) * specular * 0.5;

    // Calculate the final color
    color = vec4(ambient + diffuse, 1.0);

    // Apply ambient occlusion
    color *= sampleMaterial.ao;

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

    // int DEBUG = 1;

    // vec4 frontM;
    // vec4 topM;
    // vec4 sideM;

    // vec2 uv_front = -(worldPosition.zy) / volumeScale;
    // vec2 uv_back = (worldPosition.yz / volumeScale);

    // vec2 uv_left = worldPosition.xy / volumeScale;
    // vec2 uv_right = -(worldPosition.yz / volumeScale);

    // vec2 uv_top = worldPosition.xz / volumeScale;
    // vec2 uv_bottom = (worldPosition.zx / volumeScale);

    vec2 uv_front = worldPosition.zy / volumeScale;
    vec2 uv_back = worldPosition.yz / volumeScale;

    vec2 uv_left = worldPosition.xy / volumeScale;
    vec2 uv_right = worldPosition.yz / volumeScale;

    vec2 uv_top = worldPosition.xz / volumeScale;
    vec2 uv_bottom = worldPosition.zx / volumeScale;


    float xOffset = float(layer % 2) * 0.5;
    float yOffset = float(layer / 2) * 0.5;
    vec2 offset = vec2(xOffset, yOffset);

    vec2 scale = vec2(0.5, 0.5);

    SampledMaterial sideM;
    SampledMaterial frontM;
    SampledMaterial topM;

    // Based on the normals, we can determine which side of the cube we are on
    // and sample the correct material
    if(!materials[layer].affectedByNormal) {
        if (normals.x <= 0.5) {
            sideM = sampleMaterial(material, uv_left * scale + offset);
        } else {
            sideM = sampleMaterial(material, uv_right * scale + offset);
        }

        if (normals.z <= 0.5) {
            frontM = sampleMaterial(material, uv_back * scale + offset);
        } else {
            frontM = sampleMaterial(material, uv_front * scale + offset);
        }
    } else {
        if (normals.x <= 0.5) {
            sideM = sampleMaterial(material, uv_left * scale + (vec2(0,1) * scale));
        } else {
            sideM = sampleMaterial(material, uv_right * scale + (vec2(0,1) * scale));
        }

        if (normals.z <= 0.5) {
            frontM = sampleMaterial(material, uv_back * scale + (vec2(0,1) * scale));
        } else {
            frontM = sampleMaterial(material, uv_front * scale + (vec2(0,1) * scale));
        }
    }

    if (normals.y <= 0.5) {
        topM = sampleMaterial(material, uv_bottom * scale + (vec2(0,1) * scale));
    } else {
        topM = sampleMaterial(material, uv_top * scale + offset);
    }

    // if (normals.x <= 0.5) {
        
    //         sideM = sampleMaterial(materials[layer].material, uv_left);
    //     else
    //         sideM = sampleMaterial(materials[2].material, uv_left);
    // } else {
    //     if(!materials[layer].affectedByNormal)
    //         sideM = sampleMaterial(materials[layer].material, uv_right);
    //     else
    //         sideM = sampleMaterial(materials[2].material, uv_right);
    // }

    // if (normals.z <= 0.5) {
    //     if(!materials[layer].affectedByNormal)
    //         frontM = sampleMaterial(materials[layer].material, uv_back);
    //     else
    //         frontM = sampleMaterial(materials[2].material, uv_back);
    // } else {
    //     if(!materials[layer].affectedByNormal)
    //         frontM = sampleMaterial(materials[layer].material, uv_front);
    //     else
    //         frontM = sampleMaterial(materials[2].material, uv_front);
    // }


    // vec2 uv_s = normals.x <= 0.5 ? uv_left * scale : uv_right * scale;
    // vec2 uv_f = normals.z <= 0.5 ? uv_front * -scale : uv_back * -scale;
    // vec2 uv_t = normals.y <= 0.5 ? uv_bottom * scale : uv_top * scale;

    // SampledMaterial topM = sampleMaterial(material, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    // SampledMaterial sideM = sampleMaterial(material, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0, scale.y));
    // SampledMaterial frontM = sampleMaterial(material, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0, scale.y));

    // vec4 a_t = texture2D(albedo, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    // vec4 a_s = texture2D(albedo, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0.01, scale.y + 0.01));
    // vec4 a_f = texture2D(albedo, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0.01, scale.y + 0.01));

    // vec4 n_t = texture2D(normal, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    // vec4 n_s = texture2D(normal, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0.01, scale.y + 0.01));
    // vec4 n_f = texture2D(normal, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0.01, scale.y + 0.01));

    // vec4 ao_t = texture2D(ao, normals.y <= 0.5 ? uv_t + vec2(0, scale.y) : uv_t + offset);
    // vec4 ao_s = texture2D(ao, !materials[layer].affectedByNormal ? uv_s + offset : uv_s + vec2(0.01, scale.y + 0.01));
    // vec4 ao_f = texture2D(ao, !materials[layer].affectedByNormal ? uv_f + offset : uv_f + vec2(0.01, scale.y + 0.01));

    vec3 weights = abs(normals) / noiseScale;
    weights = weights / (weights.x + weights.y + weights.z);

    vec4 f = calculateLight(frontM);
    vec4 t = calculateLight(topM);
    vec4 s = calculateLight(sideM);

    vec4 color = debug == 1 ? vec4(weights, 1.0) : (f * weights.x) + (t * weights.y) + (s * weights.z);
    
    final = vec4(1.0) * color;
}