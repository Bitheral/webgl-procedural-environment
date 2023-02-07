in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;


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

out vec4 final;

vec4 calculateLight(SampledMaterial material) {   
    vec3 color = vec3(0);
    vec3 light = vec4(0, volumeScale * 1.5, 0, 1.0).xyz;

    // Include ambient light
    color += material.albedo.rgb * 0.99;

    // Include normal map
    vec3 normal = normalize(material.normal.rgb * 2.0 - 1.0) * 0.75;

    // Include normal light
    vec3 lightDir = normalize(vertex - light);
    float diff = max(dot(normal, lightDir), 0.0);
    color -= material.albedo.rgb * diff;

    return vec4(color, 1.0);
}

void main()
{
    
    SampledMaterial outMat = sampleMaterial(mat, uvs);

    vec3 colorOut = outMat.albedo.rgb;

    final = calculateLight(outMat);
}