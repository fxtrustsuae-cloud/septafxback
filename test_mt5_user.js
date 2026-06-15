const path = require("path");
const configuration = require("./config/config.js");
const { config, authenticate, resetAgent } = require("./mt5Services/auth.js");
const { addUser } = require("./mt5Services/user.js");

async function runTests() {
  console.log("==========================================");
  console.log("MT5 Web API Parameter Diagnostics Utility");
  console.log("==========================================");
  console.log(`Connecting to: ${configuration.MT5_URL}:${configuration.MT5_PORT}`);
  console.log(`WebManager Login ID: ${configuration.MT5_LOGIN}`);

  try {
    resetAgent();
    console.log("\n[AUTH] Authenticating with MT5 Server...");
    await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
    console.log("[AUTH] Authentication Successful!");

    console.log("\n[GROUPS] Fetching configured MT5 server groups...");
    const GroupController = require("./mt5Services/group.js");
    const groupTotalRes = await GroupController.getTotalGroup();
    if (groupTotalRes && groupTotalRes.answer) {
      const totalGroups = groupTotalRes.answer.total;
      console.log(`Total Groups found on MT5 server: ${totalGroups}`);
      console.log("MT5 Server Groups list:");
      for (let i = 0; i < totalGroups; i++) {
        const groupInfo = await GroupController.getGroupByIndex(i);
        if (groupInfo && groupInfo.answer) {
          console.log(`  - ${groupInfo.answer.Group}`);
        }
      }
    } else {
      console.log("❌ Failed to fetch groups from MT5 server!");
    }

    // Base user data template
    const baseUserData = {
      name: "Bratamalya Das Gupta",
      group: "FlexyA\\Superfast",
      PassMain: "pwdPWD@321123",
      PassInvestor: "J9glrucZ@#sd%75d",
      Email: "bratamalyad@gmail.com",
      Phone: "3453234444",
      Country: "India"
    };

    // --- TEST 1: The original payload that failed ---
    console.log("\n------------------------------------------------");
    console.log("TEST 1: Original Payload (Manual Login: 200027, Leverage: 500)");
    console.log("------------------------------------------------");
    try {
      const res1 = await addUser({
        ...baseUserData,
        login: 200027,
        Leverage: 500
      });
      console.log("Test 1 Result:", JSON.stringify(res1, null, 2));
    } catch (err) {
      console.log("Test 1 Failed:", err.message);
    }

    // --- TEST 2: Auto-allocate Login (0) & Safe Leverage (100) ---
    console.log("\n------------------------------------------------");
    console.log("TEST 2: Auto-Allocate Login (Login: 0, Leverage: 100)");
    console.log("------------------------------------------------");
    try {
      const res2 = await addUser({
        ...baseUserData,
        login: 0,
        Leverage: 100
      });
      console.log("Test 2 Result (Success!):", JSON.stringify(res2, null, 2));
    } catch (err) {
      console.log("Test 2 Failed:", err.message);
    }

    // --- TEST 3: Auto-allocate Login (0) & Original Leverage (500) ---
    console.log("\n------------------------------------------------");
    console.log("TEST 3: Auto-Allocate Login (Login: 0, Leverage: 500)");
    console.log("------------------------------------------------");
    try {
      const res3 = await addUser({
        ...baseUserData,
        login: 0,
        Leverage: 500
      });
      console.log("Test 3 Result:", JSON.stringify(res3, null, 2));
    } catch (err) {
      console.log("Test 3 Failed:", err.message);
    }

    // --- TEST 4: Manual Login (200027) & Safe Leverage (100) ---
    console.log("\n------------------------------------------------");
    console.log("TEST 4: Manual Login (Login: 200027, Leverage: 100)");
    console.log("------------------------------------------------");
    try {
      const res4 = await addUser({
        ...baseUserData,
        login: 200027,
        Leverage: 100
      });
      console.log("Test 4 Result:", JSON.stringify(res4, null, 2));
    } catch (err) {
      console.log("Test 4 Failed:", err.message);
    }

    // --- TEST 5: The CORRECT Group Name "Flexy\\Superfast" (Auto-Allocate) ---
    console.log("\n------------------------------------------------");
    console.log("TEST 5: CORRECT Group Name (Group: 'Flexy\\\\Superfast', Login: 0, Leverage: 500)");
    console.log("------------------------------------------------");
    try {
      const res5 = await addUser({
        ...baseUserData,
        group: "Flexy\\Superfast",
        login: 0,
        Leverage: 500
      });
      console.log("Test 5 Result:", JSON.stringify(res5, null, 2));
    } catch (err) {
      console.log("Test 5 Failed:", err.message);
    }

    // --- TEST 6: The CORRECT Group Name "Flexy\\Superfast" (Manual Login) ---
    console.log("\n------------------------------------------------");
    console.log("TEST 6: CORRECT Group Name (Group: 'Flexy\\\\Superfast', Login: 200027, Leverage: 500)");
    console.log("------------------------------------------------");
    try {
      const res6 = await addUser({
        ...baseUserData,
        group: "Flexy\\Superfast",
        login: 200027,
        Leverage: 500
      });
      console.log("Test 6 Result:", JSON.stringify(res6, null, 2));
    } catch (err) {
      console.log("Test 6 Failed:", err.message);
    }

  } catch (err) {
    console.error("\n❌ Global test runner failed to execute:", err);
  }
  
  console.log("\n==========================================");
  console.log("Diagnostics Complete.");
  console.log("==========================================");
  process.exit(0);
}

runTests();
