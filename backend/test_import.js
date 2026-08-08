import pdfParse from 'pdf-parse';
console.log('pdfParse type:', typeof pdfParse);
if (typeof pdfParse !== 'function') {
    console.log('pdfParse keys:', Object.keys(pdfParse));
}
