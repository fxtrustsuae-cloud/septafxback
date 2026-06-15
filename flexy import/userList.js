const UserModel = require("./models/users.model");
const AssetModel = require("./models/asset.model");
const userList = require("./csvjson.json");
const PasswordModel = require("./models/password.model");
const bcrypt = require("bcrypt");
const { createUserName, generateNumericString } = require("./helpers/index");

function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    const [datePart, timePart] = dateStr.split(" ");
    const [day, month, year] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);

    // Month is zero-based in JS Date (0 = Jan, 11 = Dec)
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (err) {
    console.error("Invalid date format:", dateStr);
    return null;
  }
}

function parseOnlyDate(dateStr) {
  if (!dateStr) return null;

  try {
    const [day, month, year] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  } catch (err) {
    console.error("Invalid date format:", dateStr);
    return null;
  }
}

async function insertUser(){

    for(const user of userList){

        const firstName = user["First Name"];
        const lastName = user["Last Name"];
        const email = user["Primary Email"];
        const mobile = user["Mobile Number"];
        const country = user["Country Name"];
        const countryCode = user["Country Code"];
        const gender = user.Gender ? user.Gender.charAt(0) : null;
        const dob = parseOnlyDate(user["Date of Birth"]);
        const isKycVerified = user["KYC Verified"]
        const createdAt = parseDate(user["Created Time"]);
        const updatedAt = parseDate(user["Modified Time"]);
        const password = user["Plain Password"];
        const ibStatus = user["IB Status"];

        console.log(
          // firstName, 
          // lastName, 
          // primaryEmail, 
          // mobileNumber,
          // countryName,
          // countryCode,
          // gender,
          // dob,
          // isKycVerified,
          // createdAt,
          // updatedAt,
          // password,
          ibStatus
        )

        // break
        
        const userName = await createUserName();
        const passwordSalt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        try {
          const newUsers = await UserModel.create({
            userName,
            name: `${firstName} ${lastName}`,
            email,
            country,
            countryCode,
            mobile,
            gender,
            dob,
            isKycVerified,
            isIb: ibStatus == "Approved" ? true: false,
            isEmailVerified: true,
            isMobileVerified: true,
            password: passwordHash,
            createdAt,
            updatedAt
          })

          await PasswordModel.create({
            userId: newUsers.id,
            mt5Login: null,
            passwordList: [
                {
                    passwordType: "LOGIN",
                    password,
                }
            ],
        });

        await AssetModel.create({
            userId: newUsers.id
        });

        } catch (e) {
          console.log(e.message)
        }
        console.log( email, country, mobile, countryCode)
        // break;
    }
}

async function updateReferral(){
    for(user of userList){
      const referralCode = user["Parent Affiliate Code"];
      const referralEmail = user["Primary Email"];
      if(!referralCode) continue;

      for(const users of userList){
        const AffiliateCode = users["Affiliate Code"];
        const email = users["Primary Email"];
        if(AffiliateCode == referralCode){
          console.log(AffiliateCode, referralCode, email)

          const mainUser = await UserModel.findOne({
            where: { email }
          }); if(!mainUser) continue;
          // console.log(mainUser)
  
          const referralUser = await UserModel.findOne({
            where: { email: referralEmail }
          });if(!referralUser) continue;
          console.log(referralUser)
          referralUser.fromUser = mainUser.id;
          await referralUser.save();
        }
        
      }
      // break

      // if(user.ibemail) {
      //   try {
      //     const ibData = await UserModel.findOne({
      //       where: { email: user.ibemail }
      //     }); if(!ibData) continue;

      //     const userData =  await UserModel.findOne({
      //       where: { email: user.email }
      //     });
          
      //     userData.fromUser = ibData.id;
      //     await userData.save();

      //   } catch (e) {
      //     console.log(e.message)
      //   }
      // }
    }
}

async function main(){
  // await insertUser()
  await updateReferral()
}

setTimeout(main, 0);