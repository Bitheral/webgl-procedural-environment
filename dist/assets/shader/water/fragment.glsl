uniform vec3 viewPosition;
in vec3 vertex;
in vec2 uvs;
in vec3 normals;
in vec3 worldPosition;
in vec3 screenPosition;

out vec4 final;

void main() {

    vec3 color = texture2D(depthBuffer, uvs).rgb;
    final = vec4(color, 1.0);
}