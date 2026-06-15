const path = require("path");
const configuration = require("./config/config.js");
const { config, authenticate, resetAgent } = require("./mt5Services/auth.js");
const { addUser } = require("./mt5Services/user.js");
const GroupController = require("./mt5Services/group.js");

async function runDiagnostics() {
  console.log("==========================================");
  console.log("MT5 Web API Parameters Diagnostic Runner");
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
          console.log(`  - ${groupInfo.answer.Group} (Max Leverage: ${groupInfo.answer.LeverageMax || "N/A"})`);
        }
      }
    } else {
      console.log("❌ Failed to fetch groups from MT5 server!");
    }

    const testGroups = ["demo\\STD", "demo\\std", "Flexy\\Superfast", "FlexyA\\Superfast"];
    const testLeverages = [500, 100, 50];

    console.log("\n[TESTS] Starting interactive parameter tests...");

    for (const groupName of testGroups) {
      for (const leverage of testLeverages) {
        console.log(`\n------------------------------------------------`);
        console.log(`TESTING: Group: "${groupName}" | Leverage: ${leverage} | Login: 0 (Auto-allocate)`);
        console.log(`------------------------------------------------`);
        try {
          const testUserPayload = {
            login: 0,
            name: "Bratamalya Test",
            group: groupName,
            Leverage: leverage,
            PassMain: "pwdPWD@321123",
            PassInvestor: "7YTtac@#sd5",
            Email: "bratamalyad@gmail.com",
            Phone: "3453234444",
            Country: "India"
          };
          const result = await addUser(testUserPayload);
          console.log(`Result:`, JSON.stringify(result, null, 2));
        } catch (err) {
          console.log(`❌ Failed with error:`, err.message);
        }
      }
    }

  } catch (err) {
    console.error("\n❌ Diagnostics failed to execute:", err);
  }
  
  console.log("\n==========================================");
  console.log("Diagnostics Complete.");
  console.log("==========================================");
  process.exit(0);
}

runDiagnostics();
