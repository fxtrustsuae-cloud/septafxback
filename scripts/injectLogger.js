const fs = require('fs');
const path = require('path');

const targets = [
  { folder: 'admin/controller', loggerType: 'adminLogger' },
  { folder: 'user/controller', loggerType: 'userLogger' },
  { folder: 'marketing/controller', loggerType: 'marketingLogger' },
];

const basePath = path.join(__dirname, '..');

const processFile = (filePath, loggerType) => {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Inject import
    if (!content.includes(loggerType)) {
        const lines = content.split('\n');
        let lastRequireIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(')) lastRequireIndex = i;
        }
        lines.splice(lastRequireIndex + 1, 0, `const { ${loggerType} } = require("../../utils/logger");`);
        content = lines.join('\n');
    }

    // Split by exported functions to isolate replacing scopes
    const exportsRegex = /(module\.exports\.[a-zA-Z0-9_]+\s*=\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{)(?!\s*\/\* processed \*\/)/g;
    
    let match;
    const scopes = [];
    while ((match = exportsRegex.exec(content)) !== null) {
        scopes.push({
            index: match.index,
            signature: match[1],
            isAsync: !!match[2],
            params: match[3],
        });
    }

    if (scopes.length === 0) return;

    for (let i = scopes.length - 1; i >= 0; i--) {
        const scope = scopes[i];
        const nextScopeIndex = i === scopes.length - 1 ? content.length : scopes[i+1].index;
        
        // Extract function block
        let block = content.slice(scope.index, nextScopeIndex);
        
        // Extract function name
        const nameMatch = scope.signature.match(/module\.exports\.([a-zA-Z0-9_]+)/);
        if (!nameMatch) continue;
        const funcName = nameMatch[1];
        
        let reqStr = 'request';
        if (scope.params.includes('req')) reqStr = 'req';

        // Check if already contains logging for this function to avoid duplicate injection
        if (block.includes(`'Entering ${funcName}'`) || block.includes(`"Entering ${funcName}"`)) {
            continue;
        }

        // 1. Inject Entering into try {
        const tryRegex = /try\s*\{/;
        block = block.replace(tryRegex, `try {\n        ${loggerType}.info('Entering ${funcName}', { method: ${reqStr}.method || "", route: ${reqStr}.originalUrl || "" });`);

        // 2. Inject Exiting before returns
        // we'll replace `return response` or `return res` with log then return
        // but we have to be careful not to break return statements.
        // It's safer to capture exactly before return response.json or return response.status
        const returnRegex = /(return\s+[a-zA-Z_]+\.(json|status|send)\()/g;
        block = block.replace(returnRegex, (m) => {
            return `${loggerType}.info('Exiting ${funcName}: Request Processed', { method: ${reqStr}.method || "", route: ${reqStr}.originalUrl || "" });\n        ${m}`;
        });

        // 3. Inject Error into catch (e) {
        const catchRegex = /catch\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*\{/;
        block = block.replace(catchRegex, (m, errVar) => {
            return `catch (${errVar}) {\n        ${loggerType}.error('Error in ${funcName}', { stack: ${errVar}.stack || ${errVar}, method: ${reqStr}.method || "", route: ${reqStr}.originalUrl || "" });`;
        });

        content = content.slice(0, scope.index) + block + content.slice(nextScopeIndex);
    }

    fs.writeFileSync(filePath, content, 'utf8');
};

console.log('Starting logger injection script...');

targets.forEach((target) => {
    const targetDir = path.join(basePath, target.folder);
    if (!fs.existsSync(targetDir)) return;

    const files = fs.readdirSync(targetDir);
    files.forEach((file) => {
        if (file.endsWith('.js')) {
            const filePath = path.join(targetDir, file);
            processFile(filePath, target.loggerType);
            console.log(`Processed: ${target.folder}/${file}`);
        }
    });
});

console.log('Injection completed successfully.');
