const fs = require('fs');
const path = './flexybank.json'; // Make sure this path is correct
const { BankDetails: BankModel, Documents: DocumentModel } = require("./models/kyc.model");
const UserModel = require("./models/users.model");

const transformStatus = (code) => {
    switch (code) {
      case '1': return 'APPROVED';
      case '2': return 'REJECTED';
      default: return 'PENDING';
    }
  };
  
  // Extract country from address
  const extractCountry = (address = "") => {
    if (address.toLowerCase().includes("india")) return "India";
    if (address.toLowerCase().includes("pakistan")) return "Pakistan";
    if (address.toLowerCase().includes("uae") || address.includes("United Arab Emirates")) return "UAE";
    if (address.toLowerCase().includes("uk") || address.toLowerCase().includes("london")) return "UK";
    if (address.toLowerCase().includes("usa") || address.toLowerCase().includes("united states")) return "USA";
    return "";
  };
  
  (async () => {
    try {
      const jsonData = fs.readFileSync(path, 'utf8');
      const records = JSON.parse(jsonData);
  
      for (const item of records) {
        const email = item.email;
  
        const userData = await UserModel.findOne({
          where: { email }
        });
  
        if (!userData) {
          console.log("Email not Found:", email);
          continue;
        }
  
        try {
          await BankModel.create({
            userId: userData.id,
            holderName: item.account_name || "",
            bankName: item.bank_name || "",
            accountNo: item.account_no || "",
            ibanNo: item.iban || null,
            ifscCode: item.ifsc || "",
            bankAddress: item.address || "",
            country: extractCountry(item.address),
            image: null,
            status: transformStatus(item.status),
            approvedBy: null,
            isDeleted: false
          });
  
          console.log(`✅ Inserted for user: ${email}`);
        } catch (err) {
          console.error(`❌ Insert error for ${email}:`, err.message);
        }
      }
  
      console.log('✅ All records processed.');
    } catch (err) {
      console.error('❌ Script error:', err);
    }
  })();