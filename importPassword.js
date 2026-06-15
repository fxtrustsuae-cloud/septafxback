const PasswordModel = require("./models/password.model");

async function resetPassword(passwordList) {
    if(passwordList.length > 1) {
        for (let i = 1; i < passwordList.length; i++) {
            console.log(passwordList[i], typeof(passwordList[i].mt5Login));
            passwordList[i].mt5Login = passwordList[i].mt5Login.toString();
        }
        console.log(passwordList)
        return passwordList;
    } else {
        return false
    }
}

async function updPassword() {
    const passwordList = await PasswordModel.findAll();
    console.log("Password length", passwordList.length)
    for(const password of passwordList){
        // console.log(password.passwordList)
        const data = await resetPassword(password.passwordList)
        if(data) {
            const passwordData = await PasswordModel.findByPk(password.id);
            passwordData.passwordList = data;
            await passwordData.save();
        }
        // break;
    }
}

updPassword()