// controllers/PdfController.js
// NOVO ARQUIVO: Centraliza a lógica de geração de PDF com Puppeteer

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs'); // File System, nativo do Node.js

// Define o caminho para a pasta pública onde os PDFs serão salvos
const publicDir = path.join(__dirname, '..', 'public');
const pdfDir = path.join(publicDir, 'pedidos_pdf');

/**
 * Garante que a pasta /public/pedidos_pdf exista.
 */
function ensurePdfDirectory() {
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }
    if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir);
    }
}

/**
 * Gera um PDF a partir de um conteúdo HTML e o salva na pasta pública.
 * Retorna a URL pública (relativa) do arquivo gerado.
 *
 * @param {string} htmlContent O conteúdo HTML completo do pedido.
 * @param {string} fileName O nome do arquivo (ex: "Pedido-123.pdf").
 * @returns {Promise<string>} A URL pública do arquivo (ex: "/pedidos_pdf/Pedido-123.pdf").
 */
async function generatePdfFromHtml(htmlContent, fileName) {
    let browser = null;
    try {
        console.log(`[PdfController] Iniciando geração do PDF: ${fileName}`);
        ensurePdfDirectory(); // Garante que a pasta /public/pedidos_pdf exista

        const filePath = path.join(pdfDir, fileName);
        
        // 1. Inicia o Puppeteer
        // 'headless: "new"' é a sintaxe moderna
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                // Adiciona um argumento para lidar com memória compartilhada (comum em servidores)
                '--disable-dev-shm-usage' 
            ]
        });

        // 2. Abre uma nova página
        const page = await browser.newPage();

        // 3. Define o conteúdo da página como o seu HTML
        
        // --- CORREÇÃO APLICADA AQUI ---
        // 'networkidle0' causa timeout ao carregar HTML local.
        // Trocado para 'domcontentloaded', que apenas espera o HTML ser carregado.
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        // --- FIM DA CORREÇÃO ---

        // 4. Gera o PDF
        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true, // Garante que cores de fundo (como no header da tabela) sejam impressas
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        console.log(`[PdfController] PDF salvo com sucesso em: ${filePath}`);

        // 5. Fecha o navegador
        await browser.close();
        browser = null;

        // 6. Retorna a URL pública (relativa)
        // O servidor Express servirá esta pasta estaticamente
        return `/pedidos_pdf/${fileName}`;

    } catch (error) {
        console.error(`[PdfController] Erro ao gerar PDF ${fileName}:`, error.message);
        if (browser) {
            await browser.close(); // Garante que o navegador feche em caso de erro
        }
        // Lança o erro para que o FuncoesController possa tratá-lo
        throw new Error(`Falha ao gerar PDF (${fileName}): ${error.message}`);
    }
}

module.exports = {
    generatePdfFromHtml
};