import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

console.log('pdfParse type:', typeof pdfParse);
console.log('pdfParse keys:', Object.keys(pdfParse));
if (typeof pdfParse !== 'function') {
    console.log('pdfParse.default type:', typeof pdfParse.default);
    console.log('pdfParse.default keys:', pdfParse.default ? Object.keys(pdfParse.default) : 'N/A');
}
