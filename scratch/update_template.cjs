const fs = require('fs');

const indexFile = 'c:\\Users\\HomePC\\Desktop\\linkup-marketplace\\supabase\\functions\\send-email-notification\\index.ts';
const templateFile = 'c:\\Users\\HomePC\\Desktop\\linkup-marketplace\\scratch\\email_preview.html';

let indexContent = fs.readFileSync(indexFile, 'utf8');
let templateContent = fs.readFileSync(templateFile, 'utf8');

// Replace the hardcoded messages with template literal variables
templateContent = templateContent.replace('Your Linkup order #12345 has been shipped and is on its way.', '${message}');
templateContent = templateContent.replace('Your order #12345 has been shipped and is on its way!', '${message}');
// Replace the relative image with absolute URL
templateContent = templateContent.replace('../public/order.png', 'https://linkupng.com/order.png');

// Find the start and end of the html string in index.ts
const startMarker = '        html: `\n';
const endMarker = '`,\n      }),\n    });';

const startIndex = indexContent.indexOf(startMarker);
if (startIndex === -1) {
    console.error('Could not find start marker in index.ts');
    process.exit(1);
}

// Find the end marker starting from the start of the html string
const endIndex = indexContent.indexOf(endMarker, startIndex);
if (endIndex === -1) {
    console.error('Could not find end marker in index.ts');
    process.exit(1);
}

const before = indexContent.slice(0, startIndex + startMarker.length);
const after = indexContent.slice(endIndex);

// Add indentation to the template for better readability in the code
// Or just let it be as is. Let's just use it as is since it's a template string.
const newContent = before + templateContent + after;

fs.writeFileSync(indexFile, newContent);
console.log('Successfully updated index.ts with the new template.');
