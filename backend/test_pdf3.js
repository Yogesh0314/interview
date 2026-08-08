import pdfParse from 'pdf-parse-new';

async function test() {
    try {
        console.log('pdfParse type:', typeof pdfParse);
        console.log(pdfParse);
    } catch (e) {
        console.error(e);
    }
}
test();
