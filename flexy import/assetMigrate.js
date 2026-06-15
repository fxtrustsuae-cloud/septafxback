const UserModel = require("./models/users.model");
const TransactionModel = require("./models/transaction.model");
const AssetModel = require("./models/asset.model");

async function deposit(){
    const depositList = await TransactionModel.findAll({
        where: { transactionType: "DEPOSIT" }
    });

    for(const deposit of depositList){
        try{
            const userData = await UserModel.findByPk(deposit.userId);
            if(!userData) continue;

            const assetData = await AssetModel.findOne({
                where: { userId: userData.id }
            }); if(!assetData) continue;

            assetData.totalMetaDeposit += Number(deposit.amount);
            await assetData.save();
            console.log(assetData)

        } catch (e) {
            console.log(e.message)
        }
    }
}
deposit()

async function withdraw(){
    const withdrawList = await TransactionModel.findAll({
        where: { transactionType: "WITHDRAW" }
    });
    
    for(const withdraw of withdrawList){
        try{
            const userData = await UserModel.findByPk(withdraw.userId);
            if(!userData) continue;

            const assetData = await AssetModel.findOne({
                where: { userId: userData.id }
            }); if(!assetData) continue;

            assetData.totalMetaWithdrawal += Number(withdraw.amount);
            await assetData.save();
            console.log(assetData)

        } catch (e) {
            console.log(e.message)
        }
    }
}
withdraw()
