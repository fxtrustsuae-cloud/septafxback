const fs = require("fs");
const path = require("path");

// Base paths for all routes
const basePaths = {
  admin: "/admin",
  user: "/user",
  marketing: "/marketing",
};

// Read and parse current postman collection
const collectionPath = path.join(__dirname, "../postmanCollection/Flexy API.postman_collection.json");
const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));

// Function to fix paths in collection items
function fixPathsInItems(items) {
  items.forEach((item) => {
    // If item has nested items (folders), process recursively
    if (item.item && Array.isArray(item.item)) {
      fixPathsInItems(item.item);
    }

    // Fix request URLs
    if (item.request && item.request.url) {
      let url = item.request.url;

      // If URL has path array, process it
      if (Array.isArray(url.path)) {
        const pathStr = "/" + url.path.join("/");

        // Replace old /api prefixes with correct ones
        let newPath = pathStr;

        if (pathStr.startsWith("/api/admin/")) {
          newPath = pathStr.replace("/api/admin/", "/admin/");
        } else if (pathStr.startsWith("/api/user/")) {
          newPath = pathStr.replace("/api/user/", "/user/");
        } else if (pathStr.startsWith("/api/marketing/")) {
          newPath = pathStr.replace("/api/marketing/", "/marketing/");
        } else if (pathStr.startsWith("/api/auth/")) {
          // Admin auth routes
          newPath = pathStr.replace("/api/auth/", "/admin/auth/");
        } else if (pathStr.startsWith("/api/")) {
          // Generic api prefix removal - assume admin
          newPath = pathStr.replace("/api/", "/admin/");
        }

        // Update path array
        url.path = newPath.split("/").filter((p) => p);

        // Update raw URL for display
        if (url.raw) {
          url.raw = url.raw.replace(/\/api\//, "/");
          // Make sure path is included
          const host = url.raw.split("/").slice(0, 3).join("/");
          const queryIndex = url.raw.indexOf("?");
          const query = queryIndex !== -1 ? url.raw.substring(queryIndex) : "";
          url.raw = host + newPath + query;
        }
      }
    }
  });
}

// Fix all items
if (collection.item && Array.isArray(collection.item)) {
  fixPathsInItems(collection.item);
}

// Save updated collection
fs.writeFileSync(collectionPath, JSON.stringify(collection, null, "\t"));

console.log("✅ Postman collection paths updated successfully!");
console.log(`📝 Updated: ${collectionPath}`);
