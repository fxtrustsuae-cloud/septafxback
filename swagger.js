require('dotenv').config();
const swaggerAutogen = require('swagger-autogen')();

const doc = {
    info: {
        title: 'Flexy API',
        description: 'API documentation for CMN Backend',
    },
    schemes: ['https', 'http'],
};

if (process.env.SWAGGER_HOST) {
    doc.host = process.env.SWAGGER_HOST;
}

const outputFile = './swagger-output.json';
const routes = ['./router.js']; // Point this to your main router file

// This will automatically read your routes and generate the swagger-output.json file
swaggerAutogen(outputFile, routes, doc).then(() => {
    const fs = require('fs');
    const file = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    
    // Auto-categorize APIs based on their first path segment (e.g., /admin/... -> Admin)
    for (const path in file.paths) {
        for (const method in file.paths[path]) {
            const parts = path.split('/');
            // parts[1] is the first word after the slash (admin, user, marketing, etc.)
            let tag = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Default';
            
            // Assign the tag
            file.paths[path][method].tags = [tag];
        }
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(file, null, 2));
    console.log("Swagger JSON generated and auto-categorized successfully!");
});
