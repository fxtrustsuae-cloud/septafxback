const { Op } = require('sequelize');
const UserModel = require("../models/users.model");
const MarketingModel = require("../models/marketingUser.model");
const { CustomErrorHandler } = require("../middleware/CustomErrorHandler");

const ibReferralList = async (userId, level = 1, userList = []) => {
    const user = await UserModel.findByPk(userId);

    if (!user) {
        return userList;
    }
    
    if (level > 1) {
        userList.push(user.id);
    }
    
    const referrals = await UserModel.findAll({ 
        where: { fromUser: userId }
    });
    
    for (const referral of referrals) {
        await ibReferralList(referral.id, level + 1, userList);
    }
    
    return userList;
};

async function assingIb(marketingMemberId, ibId) {
    try {
        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const userList = [];
        await ibReferralList(ibId, 1, userList);
        if(userList.length == 0) throw CustomErrorHandler.notFound("Referral List not found!");

        for(const userId of userList){
            const checkUser = await UserModel.findByPk(userId);
            if (!checkUser) throw CustomErrorHandler.notFound("User Not Found!");
    
            checkUser.assingToManager = checkMarketingMember.id;
            await checkUser.save();
        }
        return true;
    } catch (e) {
        console.log(e.message);
        return false;
    }
};

async function assingNewUser(){
    try {
        const userList = await UserModel.findAll({
            where: { isIb: true, isDeleted: false, assingToManager: { [Op.ne]: null } }
        }); if(!userList) return;

        console.log(userList.length);

        for(const user of userList) {
            console.log(user.email)
            await assingIb(user.assingToManager, user.id)
        }
        console.log("Updated marketing user based on ib");
    } catch (e) {
        console.log("Error", e.message);
    }
}

setInterval(assingNewUser , 10 * 60 * 1000 )