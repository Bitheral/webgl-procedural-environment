in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;
in vec3 screenPosition;
in vec3 fromLightPosition;
in vec3 toCameraPosition;

uniform sampler2D normalMap;
uniform float time;

out vec4 final;

void main() {

    vec4 finalC = vec4(0);
    int normalMapLayers = 4;
    float startingScale = 1.0;
    for(int i = 0; i < normalMapLayers; i++) {
        float scale = startingScale * pow(2.0, float(i));

        // Animate the offset by using the time
        vec2 offset = vec2(time * 0.1, time * -0.1) * 0.5;
        offset *= float(i) / scale * (time * 0.1 * float(i) / float(normalMapLayers));

        vec2 st = uvs * scale + offset;

         vec3 viewVector = normalize(toCameraPosition);

        vec4 normalMap = texture2D(normalMap, st);
        vec4 color = vec4(0, 0, 1, 0.5);

        vec3 fixedNormalMap = vec3(normalMap.x * 2.0 - 1.0, normalMap.z, normalMap.y * 2.0 - 1.0);
        vec3 normal = normalize(fixedNormalMap);

        vec3 normals_n = normalize(normals);

        vec3 reflectedLight = reflect(normalize(-fromLightPosition), normals.y >= 0.5 ? normal : normals_n);
        float specular = max(dot(reflectedLight, viewVector), 0.0);
        float depth = gl_FragCoord.z;
        float z = 2.0 * depth - 1.0; // Back to NDC
        float near = 0.1;
        float far = 32.0;
        float linearDepth = (2.0 * near) / (far + near - z * (far - near));
        float specularPower = 8.0;
        specular = pow(specular, specularPower);
        vec3 specularHighlight = vec3(1.0, 1.0, 1.0) * specular * 0.5;

        float diffuse = max(dot(normal, normalize(-fromLightPosition)), 0.0);
        vec3 diffuseColor = vec3(1.0, 1.0, 1.0) * diffuse;

        vec3 finalColor = vec3(0.0, 0.3, 0.5) + specularHighlight + diffuseColor;
        finalC += vec4(finalColor, 1.0);
    }

    final = vec4((finalC / float(normalMapLayers)).xyz, 0.5);
    // final = mix(smoothNormalMap, detailedNormMap, 0.5);
    // normals.y >= 0.5 ? color = vec4(normal.rbg, 1) : color = vec4(1, 1, 1, 1);
    // final = color;
}