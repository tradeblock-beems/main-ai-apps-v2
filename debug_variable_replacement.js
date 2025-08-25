const fs = require('fs');
const Papa = require('papaparse');

// Simple variable replacement function (matching the TypeScript logic)
const replaceVariables = (text, userData) => {
  return text.replace(/\[\[var:([a-zA-Z_][a-zA-Z0-9_]*)\]\]/g, (match, varName) => {
    const value = userData[varName];
    return value !== undefined && value !== null ? String(value) : match;
  });
};

// Test the variable replacement
console.log('🔍 DEBUGGING VARIABLE REPLACEMENT');
console.log('================================');

// Read the test CSV
const csvContent = fs.readFileSync('generated_csvs/recent-offer-creators_TEST_20250813_012705.csv', 'utf8');
const parseResult = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

console.log('📊 Available CSV columns:');
console.log(Object.keys(parseResult.data[0]));

console.log('\n📋 Test user data:');
const testUser = parseResult.data[0];
console.log(testUser);

console.log('\n🔗 Deep link tests:');
const deepLinkTemplate = 'https://tradeblock.us/product/collectors-have?productVariantId=[[var:variantID]]';
const processedLink = replaceVariables(deepLinkTemplate, testUser);

console.log('Template:', deepLinkTemplate);
console.log('Processed:', processedLink);
console.log('Success:', !processedLink.includes('[[var:'));

console.log('\n🎯 Other variable tests:');
const titleTemplate = '🎯 The target: [[var:product_name]]s 👟';
const bodyTemplate = 'We saw the offer you made — why not shoot a few more shots?\n\nSee the [[var:inventory_count]] people who have them →';

console.log('Title template:', titleTemplate);
console.log('Title processed:', replaceVariables(titleTemplate, testUser));

console.log('Body template:', bodyTemplate);
console.log('Body processed:', replaceVariables(bodyTemplate, testUser));

// Check for any missing variables
const allText = [titleTemplate, bodyTemplate, deepLinkTemplate].join(' ');
const variableRegex = /\[\[var:([a-zA-Z_][a-zA-Z0-9_]*)\]\]/g;
const variables = [];
let match;
while ((match = variableRegex.exec(allText)) !== null) {
  variables.push(match[1]);
}

console.log('\n🔍 Required variables:', variables);
console.log('📋 Available columns:', Object.keys(testUser));

const missingVars = variables.filter(v => !(v in testUser));
console.log('❌ Missing variables:', missingVars.length > 0 ? missingVars : 'None');