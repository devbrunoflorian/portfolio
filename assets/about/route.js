const query = new URLSearchParams(location.search);

if (["v2", "fresh"].includes(query.get("about-rebuild"))) {
  import("./rebuild/main.js?clean-about-2");
} else {
  import("./main.js?v=chapter-material-audio-4");
}
