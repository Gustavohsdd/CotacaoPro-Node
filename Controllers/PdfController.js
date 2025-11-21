// Controllers/PdfController.js
const PdfPrinter = require('pdfmake/src/printer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Caminho da chave
const PdfController_keyFilePath = path.join(__dirname, '..', 'cotacaopro-node-service-account.json');

// Configuração Storage
const PdfController_storage = new Storage({
    keyFilename: PdfController_keyFilePath
});

const PdfController_bucketName = 'cotacaopro-storage';
const PdfController_bucket = PdfController_storage.bucket(PdfController_bucketName);

const PdfController_fonts = {
    Roboto: {
        normal: path.join(__dirname, '..', 'fonts', 'Roboto-Regular.ttf'),
        bold: path.join(__dirname, '..', 'fonts', 'Roboto-Medium.ttf'),
        italics: path.join(__dirname, '..', 'fonts', 'Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, '..', 'fonts', 'Roboto-MediumItalic.ttf')
    }
};

/**
 * Gera um PDF na memória e faz upload direto para o Google Cloud Storage.
 * RETORNA A URL ASSINADA (LONGA) para acesso direto.
 * * @param {object} docDefinition - A definição do documento (JSON) do pdfmake.
 * @param {string} fileName - O nome do arquivo (ex: "pedido_123.pdf").
 * @param {string} folder - A pasta lógica dentro do bucket (padrão: "geral").
 * @returns {Promise<string>} - A URL assinada (válida por 7 dias) para baixar o arquivo.
 */
async function PdfController_generateAndUploadPdf(docDefinition, fileName, folder = 'geral') {
    return new Promise((resolve, reject) => {
        try {
            console.log(`[PdfController] Iniciando geração e upload: ${fileName} na pasta '${folder}'`);
            
            const printer = new PdfPrinter(PdfController_fonts);
            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            
            const destination = `${folder}/pedidos/${fileName}`;
            const file = PdfController_bucket.file(destination);

            const writeStream = file.createWriteStream({
                metadata: {
                    contentType: 'application/pdf',
                    cacheControl: 'no-cache',
                },
                resumable: false
            });

            pdfDoc.pipe(writeStream);
            pdfDoc.end();

            writeStream.on('finish', async () => {
                console.log(`[PdfController] Upload concluído: gs://${PdfController_bucketName}/${destination}`);
                
                try {
                    // Gera uma URL assinada válida por 7 dias
                    // Isso permite que quem tiver o link baixe o arquivo sem precisar de login no Google Cloud
                    const [url] = await file.getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 dias
                    });
                    
                    // RETORNA A URL COMPLETA DIRETA
                    resolve(url);
                } catch (signErr) {
                    console.error(`[PdfController] Erro ao gerar URL assinada:`, signErr);
                    reject(signErr);
                }
            });

            writeStream.on('error', (err) => {
                console.error(`[PdfController] Erro no upload para o GCS:`, err);
                reject(err);
            });

        } catch (error) {
            console.error(`[PdfController] Erro fatal no processo:`, error);
            reject(new Error(`Falha ao gerar/enviar PDF (${fileName}): ${error.message}`));
        }
    });
}

module.exports = {
    generateAndUploadPdf: PdfController_generateAndUploadPdf
};