in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;
in mat4 instMat;
in mat4 modMat;


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
uniform float volumeScale;

struct Light {
    vec3 position;
    vec3 direction;
};
uniform Light worldLight;
uniform vec3 viewPosition;

out vec4 final;

// vec4 calculateLight(SampledMaterial material) {   
//     vec3 color = vec3(0);
//     // vec3 light = vec3(volumeScale * 0.5, volumeScale * 1.5, volumeScale * 0.5);

//     // Include ambient light
//     color += material.albedo.rgb * 0.99;

//     // Include normal map
//     vec3 normal = normalize(material.normal.rgb * 2.0 - 1.0) * 0.5;

//     normal += normals;

//     // Include normal light
//     vec3 lightDir = normalize(worldLight.direction);
//     float diff = max(dot(normal, lightDir), 0.0);
//     color += material.albedo.rgb * diff;

//     return vec4(color, 1.0);
// }

vec4 calculateLight(SampledMaterial material) {   
    vec3 color = vec3(0);

    // Include ambient light
    color += material.albedo.rgb * 0.5;

    // Include normal map
    vec3 normal = normalize(material.normal.rgb * 2.0 - 1.0) * 0.5;

    // Include normal light
    vec3 lightDir = normalize(modMat * instMat * vec4(worldLight.direction, 1.0)).xyz;
    float diff = max(dot(normal, lightDir), 0.0);
    color += material.albedo.rgb * diff;

    // Include specular light
    // vec3 viewDir = normalize(viewPosition - vertex);
    // vec3 reflectDir = reflect(-lightDir, normal);
    // float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    // color += vec3(1.0) * spec;

    return vec4(color, 1.0);
}

void main()
{
    
    SampledMaterial outMat = sampleMaterial(mat, uvs);

    vec3 colorOut = outMat.albedo.rgb;

    final = calculateLight(outMat);
}