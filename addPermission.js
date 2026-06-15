const PermissionModel = require("./models/permission.model");
const MarketingModel = require("./models/marketingUser.model");

async function marketingList(){
    const marketigns = await MarketingModel.findAll();
    console.log(marketigns.length)

    for(const marketing of marketigns) {
        // console.log(marketing)
        const checkPermisson = await PermissionModel.findOne({
            where: {
                userId: marketing.id,
                permission: "PASSWORD-LIST"
            }
        })

        if(!checkPermisson) {
            await PermissionModel.create({
                userId: marketing.id,
                permission: "PASSWORD-LIST",
                isDeleted: true,
                role: marketing.role
            })
        }
    }
};

marketingList();