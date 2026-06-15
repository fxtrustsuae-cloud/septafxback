const xlsx = require('xlsx');
const path = require('path');
const UserModel = require("./models/users.model");
const TransactionModel = require("./models/transaction.model");
const AssetModel = require("./models/asset.model");

const workbook = xlsx.readFile(
  path.join(__dirname, 'Flexy Markets  Internal Transfer Report.xlsx'),
  { cellDates: true }
);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
let jsonData = xlsx.utils.sheet_to_json(sheet, { defval: null });
jsonData = jsonData.slice(1);

// Clean the data
const cleanedData = jsonData.map(row => {
  const [name, email] = (row["__EMPTY"] || "").split("/");

  return {
    name: name?.trim() || null,
    email: email?.trim() || null,
    fromMT5: row["__EMPTY_1"] || null,
    toMT5: row["__EMPTY_2"] || null,
    amount: row["__EMPTY_3"] || null,
    date: new Date(row["__EMPTY_4"])
  };
});


async function internalTransfer(){

    for(const trx of cleanedData){
        try{

            const userData = await UserModel.findOne({
                where: { email: trx.email }
            });
            if(!userData) continue;
            // console.log(userData)

            const assetData = await AssetModel.findOne({
                where: { userId: userData.id }
            }); if(!assetData) continue;
            console.log(trx)
            
            // break;
// 
            await TransactionModel.create({
                userId: userData.id,
                // mt5Login: mt5,
                amount: trx.amount,
                // paymentMethods: paymentMode != "bank"?"CRYPTO":"BANK",
                status: "COMPLETED",
                transactionType: "INTERNAL-TRANSFER",
                remark: `From ${trx.fromMT5} To ${trx.toMT5} `,
                createdAt: trx.date,
                // updatedAt: date
            });

            assetData.totalInternalTransfer += Number(trx.amount);
            await assetData.save();
            console.log(assetData)

        } catch (e) {
            console.log(e.message)
        }
    }
}
internalTransfer()