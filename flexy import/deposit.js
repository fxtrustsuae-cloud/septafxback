const UserModel = require("./models/users.model");
const TransactionModel = require("./models/transaction.model");
const depostiList = require("./depositflxy.json");

async function save(){
    for(const deposit of depostiList){
        const { email, mt5id, amount, note, paymentmethod, comment, status, date } = deposit
        // console.log({ email, mt5id, amount, note, paymentmethod, comment, status, date } )
        // break;

        const userData = await UserModel.findOne({
            where: { email }
        }); 
        if(!userData) {
            console.log("Email not Found", email)
            continue; 
        }

        await TransactionModel.create({
            userId: userData.id,
            mt5Login: mt5id,
            amount: amount,
            paymentMethods: paymentmethod == "Cregis"?"CRYPTO":"BANK",
            status: status == "1" ? "COMPLETED": "REJECTED",
            transactionType: "DEPOSIT",
            remark: `${comment}`,
            createdAt: date
        });

        console.log(mt5id)
        // break;
    }
}
save()