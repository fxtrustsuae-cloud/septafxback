const fs = require('fs');
const path = require('path');
const sequelize = require('./config/db.config');

const modelsPath = path.join(__dirname, 'models');
fs.readdirSync(modelsPath).forEach(file => {
    if (file.endsWith('.js')) {
        require(path.join(modelsPath, file));
    }
});

console.log("Loaded models:", Object.keys(sequelize.models));
process.exit(0);
