const path = require("path");
const configuration = require("./config/config.js");
const { config, authenticate, resetAgent } = require("./mt5Services/auth.js");
const GroupController = require("./mt5Services/group.js");

async function listGroups() {
  console.log("==========================================");
  console.log("MT5 Web API Group Diagnostics Utility");
  console.log("==========================================");
  console.log(`Connecting to: ${configuration.MT5_URL}:${configuration.MT5_PORT}`);
  console.log(`WebManager Login ID: ${configuration.MT5_LOGIN}`);

  try {
    resetAgent();
    console.log("\n[AUTH] Authenticating with MT5 Server...");
    await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
    console.log("[AUTH] Authentication Successful!");

    console.log("\n[GROUPS] Fetching configured MT5 server groups...");
    const groupTotalRes = await GroupController.getTotalGroup();
    if (groupTotalRes && groupTotalRes.answer) {
      const totalGroups = groupTotalRes.answer.total;
      console.log(`Total Groups found on MT5 server: ${totalGroups}`);
      console.log("MT5 Server Groups list:");
      for (let i = 0; i < totalGroups; i++) {
        const groupInfo = await GroupController.getGroupByIndex(i);
        if (groupInfo && groupInfo.answer) {
          console.log(`\n--- Group ${i + 1}: ${groupInfo.answer.Group} ---`);
          console.log(JSON.stringify(groupInfo.answer, null, 2));
        } else {
          console.log(`  - Failed to fetch details for index ${i}`);
        }
      }
    } else {
      console.log("❌ Failed to fetch groups from MT5 server!");
    }
  } catch (err) {
    console.error("\n❌ Global diagnostics failed to execute:", err);
  }
  
  console.log("\n==========================================");
  console.log("Diagnostics Complete.");
  console.log("==========================================");
  process.exit(0);
}

listGroups();
