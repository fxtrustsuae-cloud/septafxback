const AssetModel = require("../models/asset.model");
const TransactionModel = require("../models/transaction.model");

module.exports.referralReward = async (userId) => {
    try {
        const checkAsset = await AssetModel.findOne({
            where: { userId: userId }
        }); if (!checkAsset) return false;
        
        const transactionData = await TransactionModel.findOne({
            where: { userId: userId, status: "PENDING" }
        }); if (!transactionData) return false;

        transactionData.status = "COMPLETED";
        await transactionData.save();

        checkAsset.totalReferralIncome += transactionData.amount;
        checkAsset.totalRewardBalance += transactionData.amount;
        await checkAsset.save();

        return true;
    } catch (e) {
        console.log(e);
        return false
    }
};