const xlsx = require('xlsx');
const path = './Flexy Markets  User Password List (3).xlsx';
const UserModel = require("./models/users.model");
const PasswordModel = require("./models/password.model");
const bcrypt = require("bcrypt");
// Load workbook
const workbook = xlsx.readFile(path);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Convert to raw JSON
const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // 'header: 1' gives array of arrays

// Remove the first row if it's title or junk, and map data rows
const dataRows = rawData.slice(1); // Skip first row (title row)

const formattedData = dataRows
  .filter(row => row.length >= 5) // Avoid empty rows
  .map(row => ({
    name: row[1] || "",
    email: row[2] || "",
    phone: row[3] || "",
    password: row[4] || "",
    role: row[5] || ""
  }));

// console.log(formattedData);

async function savePass(){
    const passList = formattedData;

    for (const pass of passList) {
        if (!pass.email) {
            console.log("Skipping row because email is missing", pass);
            continue;
        }
    
        const userData = await UserModel.findOne({
            where: { email: pass.email }
        });
    
        if (!userData) {
            console.log("Not found email", pass.email);
            continue;
        }
    
        const passData = await PasswordModel.findOne({
            where: { userId: userData.id }
        });
    
        if (!passData) {
            console.log("Password Details not Found", pass.email);
            continue;
        }
    
        if (typeof pass.password !== "string" || !pass.password.trim()) {
            console.log(`Skipping because password is missing for email: ${pass.email}`);
            continue;
        }
    
        const updatedList = Array.isArray(passData.passwordList) ? [...passData.passwordList] : [];
        updatedList[0] = {
            passwordType: "LOGIN",
            password: pass.password,
        };
    
        passData.passwordList = updatedList;
        await passData.save();
    
        const passwordSalt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(pass.password, passwordSalt);
    
        userData.password = passwordHash;
        await userData.save();
    }
    
}
// savePass()
setTimeout(savePass, 2000);