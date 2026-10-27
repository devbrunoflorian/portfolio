import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch {
    send(response, 400, "Bad request");
    return;
  }

  if (!pathname.startsWith("/")) {
    send(response, 400, "Bad request");
    return;
  }

  let relativePath = pathname.replace(/^\/+/, "");
  if (!relativePath) relativePath = "index.html";
  else if (pathname.endsWith("/")) relativePath = path.join(relativePath, "index.html");

  const filePath = path.resolve(root, relativePath);
  const withinRoot = path.relative(root, filePath);
  if (withinRoot === ".." || withinRoot.startsWith(`..${path.sep}`) || path.isAbsolute(withinRoot)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const actualPath = await realpath(filePath);
    const actualRelativePath = path.relative(root, actualPath);
    if (actualRelativePath === ".." || actualRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelativePath)) {
      send(response, 403, "Forbidden");
      return;
    }
    if (!(await stat(actualPath)).isFile()) {
      send(response, 404, "Not found");
      return;
    }
    const body = await readFile(actualPath);
    const contentType = contentTypes.get(path.extname(actualPath).toLowerCase()) ?? "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      send(response, 404, "Not found");
      return;
    }
    send(response, 500, "Internal server error");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Portfolio preview: http://${host}:${port}/pt-br/\n`);
  process.stdout.write("Local-only server. Press Ctrl+C to stop.\n");
});
