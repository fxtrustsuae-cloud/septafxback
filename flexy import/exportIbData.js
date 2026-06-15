const fs = require("fs");
const { Op } = require("sequelize");
const IbModel = require("./models/ib.model");
const UserModel = require("./models/users.model");
const TransactionModel = require("./models/transaction.model");

const buildReferralTree = async (userId, level = 1, userList = []) => {
    const user = await UserModel.findByPk(userId);
    if (!user) return userList;
    if (level > 1) userList.push(user.id);

    const referrals = await UserModel.findAll({
        where: { fromUser: userId }
    });

    for (const referral of referrals) {
        await buildReferralTree(referral.id, level + 1, userList);
    }
    return userList;
};

async function trxReport(userList = [], transactionType) {
    try {
        if (userList.length === 0) return 0;
        const where = { userId: { [Op.in]: userList } };
        if (transactionType) where.transactionType = transactionType;

        const transactionList = await TransactionModel.findAll({ where });
        if (transactionList.length === 0) return 0;

        return transactionList.reduce((total, trx) => total + Number(trx.amount), 0);
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

async function ibList(){
    const ibList = await IbModel.findAll({
        where: { status: "APPROVED" }
    });

    const outputFile = "ib-report.json";
    fs.writeFileSync(outputFile, "["); // start JSON array

    for (let i = 0; i < ibList.length; i++) {
        const ib = ibList[i];
        const userList = [];
        await buildReferralTree(ib.userId, 1, userList);

        const totalDeposit = await trxReport(userList, "WALLET-DEPOSIT");
        const totalWithdraw = await trxReport(userList, "WALLET-WITHDRAW");

        const ibJson = ib.dataValues;
        delete ibJson.id;
        delete ibJson.userId;

        const totalReferral = userList.length;
        const newJson = { ...ibJson, totalReferral, totalDeposit, totalWithdraw };

        fs.appendFileSync(outputFile, JSON.stringify(newJson, null, 2));
        if (i < ibList.length - 1) fs.appendFileSync(outputFile, ",");
    }

    fs.appendFileSync(outputFile, "]"); // close JSON array

    console.log("File Successfully Created → ib-report.json");
}

ibList();
