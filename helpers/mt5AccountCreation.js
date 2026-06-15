const { Op, fn, col, where } = require("sequelize");

const config = require("../config/config");
const Mt5Model = require("../models/mt5Account.model");
const PasswordModel = require("../models/password.model");
const MetaControllers = require("../mt5Services/user");
const { CustomErrorHandler } = require("../middleware/CustomErrorHandler");

const MT5_CREATE_ACCOUNT_MAX_LOGIN_ATTEMPTS = Math.max(
    1,
    Number(process.env.MT5_CREATE_ACCOUNT_MAX_LOGIN_ATTEMPTS || 3)
);

function getSeriesDigits(accountType) {
    const configuredDigits = Number(
        accountType === "REAL" ? config.REAL_SERIES : config.DEMO_SERIES
    );

    if (Number.isInteger(configuredDigits) && configuredDigits > 0) {
        return configuredDigits;
    }

    return 6;
}

async function getNextMt5Login(accountType) {
    const minDigits = getSeriesDigits(accountType);

    const mt5Account = await Mt5Model.findOne({
        where: {
            accountType,
            [Op.and]: [
                where(fn("LENGTH", col("Login")), { [Op.gte]: minDigits }),
            ],
        },
        order: [["createdAt", "DESC"]],
    });

    if (mt5Account?.Login) {
        return Number(mt5Account.Login) + 1;
    }

    return Math.pow(10, minDigits - 1);
}

async function upsertPasswordList(userId, login, passMain, passInvestor) {
    const nextPasswords = [
        { passwordType: "MT5-MAIN", password: passMain, mt5Login: login },
        { passwordType: "MT5-INVESTOR", password: passInvestor, mt5Login: login },
    ];

    const passwordEntry = await PasswordModel.findOne({ where: { userId } });

    if (!passwordEntry) {
        await PasswordModel.create({
            userId,
            passwordList: nextPasswords,
        });
        return;
    }

    await passwordEntry.update({
        passwordList: [...passwordEntry.passwordList, ...nextPasswords],
    });
}

async function createMt5AccountFromGroup({
    userData,
    groupData,
    leverage,
    passMain,
    passInvestor,
}) {
    const mt5GroupName = groupData?.mt5GroupData?.mt5GroupName;
    if (!mt5GroupName) {
        throw CustomErrorHandler.notFound("MT5 group configuration not found!");
    }

    const numericLeverage = parseInt(leverage, 10);
    let login = await getNextMt5Login(groupData.type);

    const metaUserData = {
        login,
        name: userData.name,
        group: mt5GroupName,
        Leverage: numericLeverage,
        PassMain: passMain,
        PassInvestor: passInvestor,
        Email: userData.email,
        Phone: userData.mobile || "",
        Country: userData.country || "",
        City: "",
        State: "",
        ZipCode: "",
        Address: "",
        PhonePassword: "",
    };

    let newUserData = null;
    let lastAddUserResult = null;
    const maxLoginAttempts = MT5_CREATE_ACCOUNT_MAX_LOGIN_ATTEMPTS;

    for (let attempt = 0; attempt < maxLoginAttempts; attempt += 1) {
        metaUserData.login = login + attempt;
        const result = await MetaControllers.addUser(metaUserData);
        lastAddUserResult = result;

        if (result && !result._mt5Error) {
            newUserData = result;
            break;
        }

        if (result?._mt5Error && result.retcode === 3004) {
            continue;
        }

        break;
    }

    if (!newUserData && lastAddUserResult?._mt5Error) {
        metaUserData.login = 0;
        const result = await MetaControllers.addUser(metaUserData);
        if (result && !result._mt5Error) {
            newUserData = result;
        }
    }

    if (!newUserData?.answer) {
        if (lastAddUserResult === false) {
            throw CustomErrorHandler.serverError("MT5 service did not respond in time. Please try again.");
        }
        throw CustomErrorHandler.serverError("Failed to Create MT5 User!");
    }

    const answer = newUserData.answer;
    const resolvedLogin = answer.Login || String(metaUserData.login);

    await upsertPasswordList(userData.id, resolvedLogin, passMain, passInvestor);

    const newAccount = await Mt5Model.create({
        userId: userData.id,
        Login: resolvedLogin,
        accountType: groupData.type,
        groupId: groupData.id,
        CertSerialNumber: answer.CertSerialNumber || "0",
        Rights: answer.Rights || "",
        MQID: answer.MQID || "0",
        Registration: answer.Registration || "",
        LastAccess: answer.LastAccess || "",
        LastPassChange: answer.LastPassChange || "",
        LastIP: answer.LastIP || "",
        Name: answer.Name || userData.name || "",
        FirstName: answer.FirstName || "",
        LastName: answer.LastName || "",
        MiddleName: answer.MiddleName || "",
        Company: answer.Company || "",
        Account: answer.Account || "",
        Country: answer.Country || userData.country || "",
        Language: answer.Language || "0",
        ClientID: answer.ClientID || "0",
        City: answer.City || "",
        State: answer.State || "",
        ZipCode: answer.ZipCode || "",
        Address: answer.Address || "",
        Phone: answer.Phone || userData.mobile || "",
        Email: answer.Email || userData.email || "",
        ID: answer.ID || "",
        Status: answer.Status || "",
        Comment: answer.Comment || "",
        Color: answer.Color || "",
        PhonePassword: answer.PhonePassword || "",
        Leverage: answer.Leverage || String(numericLeverage || ""),
        Agent: answer.Agent || "0",
        LimitPositions: answer.LimitPositions || "0",
        LimitOrders: answer.LimitOrders || "0",
        CurrencyDigits: answer.CurrencyDigits || "2",
        Balance: parseFloat(answer.Balance || "0.00"),
        Credit: parseFloat(answer.Credit || "0.00"),
        InterestRate: parseFloat(answer.InterestRate || "0.00"),
        CommissionDaily: parseFloat(answer.CommissionDaily || "0.00"),
        CommissionMonthly: parseFloat(answer.CommissionMonthly || "0.00"),
        CommissionAgentDaily: parseFloat(answer.CommissionAgentDaily || "0.00"),
        CommissionAgentMonthly: parseFloat(answer.CommissionAgentMonthly || "0.00"),
        BalancePrevDay: parseFloat(answer.BalancePrevDay || "0.00"),
        BalancePrevMonth: parseFloat(answer.BalancePrevMonth || "0.00"),
        EquityPrevDay: parseFloat(answer.EquityPrevDay || "0.00"),
        EquityPrevMonth: parseFloat(answer.EquityPrevMonth || "0.00"),
        TradeAccounts: answer.TradeAccounts || "",
    });

    return { newAccount, newUserData };
}

module.exports = {
    createMt5AccountFromGroup,
    getNextMt5Login,
};
