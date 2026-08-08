import * as pdfPkg from 'pdf-parse';
console.log('pdfPkg keys:', Object.keys(pdfPkg));
const { PDFParse } = pdfPkg;
if (PDFParse) {
    console.log('PDFParse properties:', Object.getOwnPropertyNames(PDFParse.prototype));
}
