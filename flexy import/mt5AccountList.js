const UserModel = require("./models/users.model");
const Mt5Model = require("./models/mt5Account.model");
const PasswordModel = require("./models/password.model");
const Mt5GroupModel = require("./models/mt5Group.model");
const GroupModel = require("./models/group.model");
const userList = require("./mt5_userlistflxy.json");

async function main(){
  let a = 0;
  for(let i = 0; i<Number(userList.length); i++){
    const { email, mt5id, name, groupname, date, investpass, mainpass} = userList[i]

    // console.log(groupname)
    const mt5GroupData = await Mt5GroupModel.findOne({
      where: { mt5GroupName: groupname }
    });
    // console.log(mt5GroupData.id)

    const groupData = await GroupModel.findOne({
      where: { mt5Group: mt5GroupData.id }
    })
    let groupId = 1;
    if(groupData) groupId = groupData.id;

    // console.log(email, mt5id, name, groupname, date, investpass, mainpass)
    try {
      const userData = await UserModel.findOne({
        where: { email: email }
      });
      if(!userData){
        console.log("Email not Found", email)
        continue;
      } 
      // break;
      const newAcc = await Mt5Model.create({
        userId: userData.id,
        Login: mt5id,
        groupId,
        Name: name,
        Email: email,
        createdAt: date
      });

      let passwordEntry = await PasswordModel.findOne({ where: { userId: userData.id } });

      const updatedList = [...passwordEntry.passwordList];

      updatedList.push(
          { passwordType: "MT5-MAIN", password: mainpass, mt5Login: mt5id },
          { passwordType: "MT5-INVESTOR", password: investpass, mt5Login: mt5id }
      );

      passwordEntry.passwordList = updatedList;
      await passwordEntry.save();
  
      console.log(newAcc.Login, ++a, i)

    } catch (e) {
      console.log(e.message)
    }

  }
}

setTimeout(main, 1000);
// main(); // call the main function