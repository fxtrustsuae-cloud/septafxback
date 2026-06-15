const fs = require("fs");
const path = require("path");

const root = process.cwd();
const collectionPath = path.join(root, "postmanCollection", "Flexy API.postman_collection.json");

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function parseRouterConfig(routerFile) {
  const content = stripComments(fs.readFileSync(routerFile, "utf8"));
  const requireMap = new Map();

  let match;
  const requireRegex = /const\s+(\w+)\s*=\s*require\(["']\.\/([^"']+)["']\)\s*;/g;
  while ((match = requireRegex.exec(content))) {
    requireMap.set(match[1], match[2]);
  }

  const mounts = [];
  const useRegex = /router\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g;
  while ((match = useRegex.exec(content))) {
    const mountPath = match[1];
    const routerVar = match[2];
    const rel = requireMap.get(routerVar);
    if (!rel) continue;
    mounts.push({ mountPath, relFile: `${rel}.js`, relBase: rel });
  }

  return mounts;
}

function parseEndpoints(routeFile) {
  const content = stripComments(fs.readFileSync(routeFile, "utf8"));
  const regex = /router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
  const endpoints = [];

  let match;
  while ((match = regex.exec(content))) {
    endpoints.push({ method: match[1].toUpperCase(), routePath: match[2] });
  }

  return endpoints;
}

function normalizePath(pathValue) {
  if (!pathValue.startsWith("/")) return `/${pathValue}`;
  return pathValue;
}

function joinPath(base, mount, endpoint) {
  const b = normalizePath(base).replace(/\/+$/, "");
  const m = normalizePath(mount);
  const e = normalizePath(endpoint);
  const mountPart = m === "/" ? "" : m;
  return `${b}${mountPart}${e === "/" ? "" : e}`.replace(/\/+/g, "/");
}

function folderNameFromMount(mountPath, relBase) {
  const fallback = relBase.replace(".route", "").replace(".router", "").replace("./", "");
  if (mountPath === "/" || mountPath.trim() === "") return fallback;
  return mountPath.replace(/^\//, "").replace(/\//g, "-");
}

function toPostmanPath(fullPath) {
  return fullPath
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith(":") ? `{{${segment.slice(1)}}}` : segment));
}

function createRequestItem(method, fullPath) {
  const raw = `{{host}}${fullPath.replace(/:([A-Za-z0-9_]+)/g, "{{$1}}")}`;
  const headers = [{ key: "Authorization", value: "{{jwtToken}}", type: "text" }];

  const request = {
    method,
    header: headers,
    url: {
      raw,
      host: ["{{host}}"],
      path: toPostmanPath(fullPath),
    },
  };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    request.header.push({ key: "Content-Type", value: "application/json", type: "text" });
    request.body = {
      mode: "raw",
      raw: "{}",
      options: { raw: { language: "json" } },
    };
  }

  return {
    name: `${method} ${fullPath}`,
    request,
    response: [],
  };
}

function buildRoleFolder(roleName, routerConfigPath, apiBase, includeMount = () => true) {
  const routerDir = path.dirname(routerConfigPath);
  const mounts = parseRouterConfig(routerConfigPath).filter((mount) =>
    includeMount(mount.mountPath, mount.relBase)
  );

  const endpointMap = new Map();
  for (const mount of mounts) {
    const routeFile = path.join(routerDir, mount.relFile);
    if (!fs.existsSync(routeFile)) continue;

    for (const endpoint of parseEndpoints(routeFile)) {
      const fullPath = joinPath(apiBase, mount.mountPath, endpoint.routePath);
      endpointMap.set(`${endpoint.method} ${fullPath}`, {
        method: endpoint.method,
        fullPath,
      });
    }
  }

  const items = Array.from(endpointMap.values())
    .sort((a, b) =>
      a.fullPath === b.fullPath
        ? a.method.localeCompare(b.method)
        : a.fullPath.localeCompare(b.fullPath)
    )
    .map((endpoint) => createRequestItem(endpoint.method, endpoint.fullPath));

  return {
    name: roleName,
    item: items,
  };
}

function buildSocketFolder() {
  return {
    name: "Socket",
    item: [
      {
        name: "Socket.IO Handshake (Polling)",
        request: {
          method: "GET",
          header: [
            { key: "Authorization", value: "{{jwtToken}}", type: "text" }
          ],
          url: {
            raw: "{{host}}/socket.io/?EIO=4&transport=polling",
            host: ["{{host}}"],
            path: ["socket.io", ""],
            query: [
              { key: "EIO", value: "4" },
              { key: "transport", value: "polling" }
            ]
          },
          description:
            "Socket.IO events are handled in config/socketIO.js. Use this request for initial handshake/testing. Important events: startPayment, cardPayment, checkMargin, adminCheckMargin, checkPosition, checkPositionUser."
        },
        response: []
      }
    ]
  };
}

function run() {
  const adminFolder = buildRoleFolder(
    "Admin",
    path.join(root, "admin/router/router.js"),
    "/api/admin",
    (mountPath) => mountPath !== "/admins"
  );
  const superAdminFolder = buildRoleFolder(
    "Superadmin",
    path.join(root, "admin/router/router.js"),
    "/api/admin",
    (mountPath) => mountPath === "/admins"
  );
  const userFolder = buildRoleFolder("User", path.join(root, "user/router/router.js"), "/api/user");
  const marketingFolder = buildRoleFolder("Marketing", path.join(root, "marketing/router/router.js"), "/api/marketing");

  const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));
  if (!Array.isArray(collection.item)) collection.item = [];

  const removeNames = new Set([
    "Admin",
    "Superadmin",
    "User",
    "Marketing",
    "Admin APIs (Auto)",
    "Superadmin APIs (Auto)",
    "User APIs (Auto)",
    "Marketing APIs (Auto)",
  ]);

  collection.item = collection.item.filter((section) => !removeNames.has(section.name));
  collection.item.push(adminFolder, superAdminFolder, userFolder, marketingFolder);

  fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, "\t")}\n`);

  console.log(
    `Updated: Admin APIs=${adminFolder.item.length}, Superadmin APIs=${superAdminFolder.item.length}, User APIs=${userFolder.item.length}, Marketing APIs=${marketingFolder.item.length}`
  );
}

run();
