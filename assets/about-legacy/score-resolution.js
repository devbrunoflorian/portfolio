// The closing turn uses the same strip and staff offsets as the rest of the journey.
export const resolutionShader = `
  vec4 resolutionView(vec4 view, float u, float staffOffset, float journey,
                      vec2 viewportSize, float focalLength) {
    if (journey >= 0. && journey < 1.) {
      float portrait = 1. - smoothstep(.85, 1.24, viewportSize.x/viewportSize.y);
      float opening = 1. - smoothstep(.14, .9, journey);
      float depth = mix(.48, 2.45, smoothstep(0., 1., u));
      float x = (.48*u + .25*sin(3.14*u) + .14*sin(6.28*u)) * mix(1., 1.52, portrait);
      float y = .13*sin(6.28*u) - .09*u;
      vec3 entry = vec3((x-.5)*viewportSize.x*depth,
                        y*viewportSize.y*depth + staffOffset,
                        -focalLength*depth);
      view.xyz = mix(view.xyz, entry, opening);
    }
    float travel = clamp(journey - 4., 0., 1.);
    float weight = sin(3.14159265 * travel);
    weight *= weight;
    if (weight < .00001) return view;
    float angle = 8.7 * u - .95 + 1.65 * travel;
    float radius = mix(.42, .075, u) * min(viewportSize.x, viewportSize.y * 2.);
    vec3 coil = vec3(radius*cos(angle), radius*.34*sin(angle) + staffOffset*.85,
                     -focalLength*(.91 + .64*u) + radius*.29*sin(angle));
    return vec4(mix(view.xyz, coil, weight), 1.);
  }
`;
