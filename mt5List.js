const fs = require('fs');
const XLSX = require('xlsx');
const UserModel = require("./models/users.model");
const Mt5Model = require("./models/mt5Account.model");
const PasswordModel = require("./models/password.model");

// Path to the Excel file
const filePath = 'mt5List.xlsx';

// Read the Excel file
const workbook = XLSX.readFile(filePath);

// Specify the sheet to read
const sheetName = 'Sheet2';
const sheet = workbook.Sheets[sheetName];

if (!sheet) {
  console.error(`Sheet "${sheetName}" not found in the workbook.`);
  process.exit(1);
}

// Convert the sheet to JSON format with headers as keys
let jsonData = XLSX.utils.sheet_to_json(sheet);

// Clean up the JSON data by trimming header names
jsonData = jsonData.map(row => {
  const cleanedRow = {};
  for (const key in row) {
    cleanedRow[key.trim()] = row[key]; // Trim spaces from keys
  }
  return cleanedRow;
});

// Loop through the JSON data and console log only the ContactName
async function metaAccount(){
  let a = 0;
    for (const acc of jsonData) {
        const { ContactName, PrimaryEmail, AccountNumber, Leverage, TradingPassword, InvestorPassword, CreatedTime } = acc;
        
        let groupId = 1;
        const userData = await UserModel.findOne({
            where: { email: PrimaryEmail }
        });
        if(!userData){
            console.log("Email not Found", PrimaryEmail)
            continue;
        } 
        console.log({
          userId: userData.id,
          Login: AccountNumber,
          groupId,
          Name: ContactName,
          Email: PrimaryEmail,
          Leverage,
          // createdAt: CreatedTime
      })
      // continue
        // break;
        const newAcc = await Mt5Model.create({
            userId: userData.id,
            Login: AccountNumber,
            groupId,
            Name: ContactName,
            Email: PrimaryEmail,
            Leverage,
            // createdAt: CreatedTime
        });
    
        let passwordEntry = await PasswordModel.findOne({ where: { userId: userData.id } });
    
        const updatedList = [...passwordEntry.passwordList];
    
        updatedList.push(
            { passwordType: "MT5-MAIN", password: TradingPassword, mt5Login: AccountNumber },
            { passwordType: "MT5-INVESTOR", password: InvestorPassword, mt5Login: AccountNumber }
        );
    
        passwordEntry.passwordList = updatedList;
        await passwordEntry.save();
    
        console.log(newAcc.Login, ++a)
    }
}
metaAccount()