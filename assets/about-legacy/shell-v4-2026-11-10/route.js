const mode = new URLSearchParams(location.search).get("about-rebuild");

if (["legacy", "old"].includes(mode)) {
  import("../about-legacy/main.js?legacy-about-1");
} else if (["legacy-draft", "v2"].includes(mode)) {
  import("../about-legacy/legacy-draft/main.js?legacy-draft-1");
} else if (mode === "v3") {
  import("../about-legacy/rebuild/main.js?legacy-composition-3");
} else {
  import("./main.js?about-fresh-3");
}
