const UserModel = require("../../models/users.model");
const { actionTracking } = require("../../helpers/index");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { Op } = require("sequelize");
const { userLogger } = require("../../utils/logger");

module.exports.uploadDocument = async (request, response) => {
    try {
        userLogger.info('Entering uploadDocument', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const poi = request.files.poi ? request.files.poi[0].filename : null;
        const poa = request.files.poa ? request.files.poa[0].filename : null;

        const extraDocs = request.files.extraDocs
            ? request.files.extraDocs.map(f => f.filename)
            : [];

        const checkKycDoc = await DocumentModel.findOne({
            where: { userId: user.id, isDeleted: false },
        }); 
        if(checkKycDoc && checkKycDoc.status === "PENDING"){
            throw CustomErrorHandler.alreadyExist("Wait for admin approval!")
        } 
        if(checkKycDoc && checkKycDoc.status === "APPROVED"){
            throw CustomErrorHandler.alreadyExist("Kyc Verified!")
        };

        let document;
        if (checkKycDoc && checkKycDoc.status === "REJECTED") {
            const updateData = {};
            if (poi && (checkKycDoc.poi === null || poi)) updateData.poi = poi;
            if (poa && (checkKycDoc.poa === null || poa)) updateData.poa = poa;

            if (extraDocs.length > 0) {
                updateData.extraDocs = [
                    ...(checkKycDoc.extraDocs || []),
                    ...extraDocs
                ];
            }

            if (Object.keys(updateData).length > 0) {
                updateData.status = "PENDING";
                updateData.approvedBy = null;
                document = await checkKycDoc.update(updateData);
            } else {
                throw new Error("No new documents provided for update.");
            }
        } else {
            // Create new record
            document = await DocumentModel.create({
                userId: userData.id,
                poi,
                poa,
                extraDocs
            });
        }

        actionTracking(request, userData.id, "KYC-DOC-UPDATED");
        userLogger.info('Exiting uploadDocument: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Document Uploaded.",
            data: document,
        });
    } catch (e) {
        userLogger.error('Error in uploadDocument', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addBank = async (request, response) => {
    try {
        userLogger.info('Entering addBank', { method: request.method || "", route: request.originalUrl || "" });
        const { holderName, accountNo, ifscCode, ibanNo, bankName, bankAddress, country } = request.query;
        const { user } = request.body;

        const image = request.files && request.files.image ? request.files.image[0].filename : null;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        // Check account NO
        const checkAccountNo = await BankModel.findOne({
            where: { accountNo }
        });
        if (checkAccountNo) {
            throw CustomErrorHandler.alreadyExist("This Account Already Exist!");
        }

        const newBank = await BankModel.create({
            userId: userData.id,
            holderName,
            accountNo,
            ifscCode,
            ibanNo,
            bankName,
            bankAddress,
            country,
            image,
            status: "PENDING",
            approvedBy: null,
            remark: null
        });

        const approvedBankCount = await BankModel.count({
            where: {
                userId: userData.id,
                isDeleted: false,
                status: "APPROVED"
            }
        });
        userData.isBankVerified = approvedBankCount > 0;
        await userData.save();

        actionTracking(request, userData.id, "BANK-UPDATED");
        userLogger.info('Exiting addBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Bank added.",
            data: newBank,
        });
    } catch (e) {
        userLogger.error('Error in addBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateBank = async (request, response) => {
    try {
        userLogger.info('Entering updateBank', { method: request.method || "", route: request.originalUrl || "" });
        const { bankId, isDeleted, holderName, accountNo, ifscCode, ibanNo, bankName, bankAddress, country } = request.query;
        const { user } = request.body;

        const image = request.files && request.files.image ? request.files.image[0].filename : null;
        const shouldDelete = isDeleted === true || isDeleted === "true" || isDeleted === 1 || isDeleted === "1";

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkBank = await BankModel.findOne({
            where: { id: bankId, userId: userData.id, isDeleted: false }
        }); if (!checkBank) throw CustomErrorHandler.notFound("Bank Not Found!");

        if (shouldDelete) {
            await checkBank.update({
                isDeleted: true,
                deletedAt: new Date()
            });

            const approvedBankCount = await BankModel.count({
                where: {
                    userId: userData.id,
                    isDeleted: false,
                    status: "APPROVED",
                    id: { [Op.ne]: checkBank.id }
                }
            });

            userData.isBankVerified = approvedBankCount > 0;
            await userData.save();

            actionTracking(request, userData.id, "BANK-DELETED");
            userLogger.info('Exiting updateBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
                status: true,
                message: "Bank deleted.",
                data: null,
            });
        }

        if (accountNo && accountNo !== checkBank.accountNo) {
            const checkAccountNo = await BankModel.findOne({
                where: { accountNo, isDeleted: false }
            });
            if (checkAccountNo) {
                throw CustomErrorHandler.alreadyExist("This Account Already Exist!");
            }
        }

        const updateData = {};
        if (holderName) updateData.holderName = holderName;
        if (accountNo) updateData.accountNo = accountNo;
        if (ifscCode) updateData.ifscCode = ifscCode;
        if (ibanNo) updateData.ibanNo = ibanNo;
        if (bankName) updateData.bankName = bankName;
        if (bankAddress) updateData.bankAddress = bankAddress;
        if (country) updateData.country = country;
        if (image) updateData.image = image;

        if (Object.keys(updateData).length === 0) {
            throw CustomErrorHandler.badRequest("No data provided for update!");
        }

        updateData.status = "PENDING";
        updateData.approvedBy = null;
        updateData.remark = null;

        const updatedBank = await checkBank.update(updateData);

        actionTracking(request, userData.id, "BANK-UPDATED");
        userLogger.info('Exiting updateBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Bank updated.",
            data: updatedBank,
        });
    } catch (e) {
        userLogger.error('Error in updateBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getbank = async (request, response) => {
    try {
        userLogger.info('Entering getbank', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const banks = await BankModel.findAll({
            where: { userId: userData.id},
            order: [["createdAt", "DESC"]]
        });
        if (!banks || banks.length === 0) throw CustomErrorHandler.notFound("Bank Not Found!");

        const host = `${request.protocol}://${request.get("host")}`;
        const bankList = banks.map((bank) => {
            const item = bank.toJSON();
            item.image = item.image ? `${host}/public/bankDetails/${item.image}` : null;
            return item;
        });
                   
        actionTracking(request, userData.id, "CHECKED-BANK");
        userLogger.info('Exiting getbank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details.",
            data: bankList,
        });
    } catch (e) {
        userLogger.error('Error in getbank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getDocument = async (request, response) => {
    try {
        userLogger.info('Entering getDocument', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        });
        if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const documentData = await DocumentModel.findOne({
            where: { userId: userData.id }
        });

        const host = `${request.protocol}://${request.get("host")}`;
        const makeUrl = (file) => file ? `${host}/public/documents/${file}` : null;

        if (!documentData) {
            return response.json({
                status: true,
                message: "Document Details.",
                data: {
                    userId: userData.id,
                    poi: null,
                    poa: null,
                    extraDocs: [],
                    status: null,
                    remark: null,
                },
            });
        }

        // Format extraDocs array safely
        let extraDocs = [];
        if (documentData.extraDocs && Array.isArray(documentData.extraDocs)) {
            extraDocs = documentData.extraDocs.map((file) => makeUrl(file));
        }

        const responseData = {
            ...documentData.toJSON(),
            poi: makeUrl(documentData.poi),
            poa: makeUrl(documentData.poa),
            extraDocs: extraDocs
        };

        actionTracking(request, userData.id, "CHECKED-KYC-DOC");

        userLogger.info('Exiting getDocument: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Document Details.",
            data: responseData,
        });

    } catch (e) {
        userLogger.error('Error in getDocument', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

