const fs = require('fs');
const path = require('path');

const targets = [
  'admin/controller',
  'user/controller',
  'marketing/controller'
];

const basePath = path.join(__dirname, '..');

targets.forEach((targetFolder) => {
    const targetDir = path.join(basePath, targetFolder);
    if (!fs.existsSync(targetDir)) return;

    const files = fs.readdirSync(targetDir);
    files.forEach((file) => {
        if (file.endsWith('.js')) {
            const filePath = path.join(targetDir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            
            const exportsRegex = /(module\.exports\.[a-zA-Z0-9_]+\s*=\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{)(?!\s*\/\* processed \*\/)/g;
            
            let match;
            const scopes = [];
            while ((match = exportsRegex.exec(content)) !== null) {
                scopes.push({
                    index: match.index,
                    signature: match[1],
                    params: match[3],
                });
            }

            if (scopes.length === 0) return;

            for (let i = scopes.length - 1; i >= 0; i--) {
                const scope = scopes[i];
                const nextScopeIndex = i === scopes.length - 1 ? content.length : scopes[i+1].index;
                
                let block = content.slice(scope.index, nextScopeIndex);
                
                let reqStr = null;
                // strict match for param "request" vs "req"
                const paramsList = scope.params.split(',').map(p => p.trim());
                if (paramsList.includes('request')) reqStr = 'request';
                else if (paramsList.includes('req')) reqStr = 'req';

                if (reqStr) {
                    // fix exactly the injected lines
                    block = block.replace(/method: req\.method/g, `method: ${reqStr}.method`);
                    block = block.replace(/route: req\.originalUrl/g, `route: ${reqStr}.originalUrl`);
                    
                    block = block.replace(/method: request\.method/g, `method: ${reqStr}.method`);
                    block = block.replace(/route: request\.originalUrl/g, `route: ${reqStr}.originalUrl`);
                }

                content = content.slice(0, scope.index) + block + content.slice(nextScopeIndex);
            }

            fs.writeFileSync(filePath, content, 'utf8');
        }
    });
});
console.log('Fix script completed');
