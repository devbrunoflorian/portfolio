const query = new URLSearchParams(location.search);

const version = query.get("about-rebuild");

if (["legacy", "old"].includes(version)) {
  import("./main.js?v=chapter-material-audio-4");
} else if (["legacy-draft", "v2"].includes(version)) {
  import("./legacy-draft/main.js?legacy-about-draft-1");
} else {
  import("./rebuild/main.js?about-rebuild-2");
}
