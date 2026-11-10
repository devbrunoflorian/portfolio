const query = new URLSearchParams(location.search);

if (query.get("about-rebuild") === "v2") {
  import("./rebuild/main.js?v=17");
} else {
  import("./main.js?v=chapter-material-audio-4");
}
