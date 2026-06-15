const { Op } = require("sequelize");
const TradeRequestControllers = require("../mt5Services/tradeRequest");
const TransactionModel = require("../models/transaction.model");
const { CustomErrorHandler } = require("../middleware/CustomErrorHandler");

async function bonusWithdraw(){
    try{
        const currentTime = new Date();
        const transactionList = await TransactionModel.findAll({
            where: {
                expireAt: {
                    [Op.lt]: currentTime, 
                },
                transactionType: "CREDIT-DEPOSIT",
                isDeleted: false
            },
        });

        for(const transaction of transactionList){
            const newWithdraw = await TradeRequestControllers.depositWithdraw(transaction.mt5Login, 3, -transaction.amount, "Bonus Removed");
            if(!newWithdraw) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);

            await TransactionModel.create({
                userId: transaction.userId,
                mt5Login: transaction.amount,
                amount: transaction.amount,
                transactionType: "BONUS-WITHDRAW",
                remark: "Bonus Removed.",
            });

            await TransactionModel.update(
                { isDeleted: true },
                {
                    where: { id: transaction.id, isDeleted: false },
                    returning: true, // only works with PostgreSQL
                }
            );
        }
    } catch (e){
        console.log("Error while Bonus Removed through cron", e.message);
    }
}

setInterval(bonusWithdraw, 1000 * 60 * 60 * 10)