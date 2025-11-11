// Importa as bibliotecas
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises; // Usaremos o File System (fs) do Node para ler os arquivos .ejs
const { google } = require('googleapis');

// --- Configuração do Aplicativo ---
const app = express();
const PORT = process.env.PORT || 8080;

// --- Autenticação (Cliente Google) ---
// (Esta função permanece a mesma)
async function getAuthClient() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credentialsJson) {
    throw new Error('A variável GOOGLE_SERVICE_ACCOUNT_CREDENTIALS não foi encontrada no .env');
  }
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  return auth.getClient();
}

// --- Configuração do Servidor Express ---
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Injeção de Clientes (para usar nas rotas) ---
// Criamos os clientes uma vez e os disponibilizamos para todas as rotas
// Isso é mais eficiente do que autenticar a cada clique
app.use(async (req, res, next) => {
  try {
    if (!app.locals.googleAuthClient) {
      // Se o cliente ainda não foi criado, cria e armazena
      app.locals.googleAuthClient = await getAuthClient();
      app.locals.googleSheets = google.sheets({ version: 'v4', auth: app.locals.googleAuthClient });
      app.locals.googleDrive = google.drive({ version: 'v3', auth: app.locals.googleAuthClient });
    }
    // Disponibiliza os clientes para a rota atual
    req.sheets = app.locals.googleSheets;
    req.drive = app.locals.googleDrive;
    next();
  } catch (error) {
    console.error("Erro fatal na autenticação do Google:", error.message);
    res.status(500).send("Falha ao autenticar com os serviços do Google.");
  }
});

// --- ROTAS (Migração do seu App.js) ---

/**
 * Rota Principal (GET /)
 * Substitui o doGet() padrão do GAS.
 * Renderiza a PaginaPrincipal.ejs.
 */
app.get('/', (req, res) => {
  // 'render' usa o EJS para processar o arquivo
  // O EJS irá procurar por 'views/PaginaPrincipal.ejs'
  res.render('PaginaPrincipal', {
    // Aqui podemos injetar variáveis no EJS, se necessário
    // Por exemplo:
    // usuario: "Gustavo" 
    // No EJS: <%= usuario %>
  });
});

/**
 * Rota para obter Views (GET /view/:viewName)
 * Substitui a função App_obterView(viewName) do GAS.
 * Usada pelo seu frontend para carregar as páginas.
 */
app.get('/view/:viewName', async (req, res) => {
  const viewName = req.params.viewName;
  
  // Lista de views permitidas (migrada do App_VIEWS_PERMITIDAS)
  const viewMap = {
    "fornecedores": "FornecedoresView",
    "produtos": "ProdutosView",
    "subprodutos": "SubProdutosView",
    "cotacoes": "CotacoesView",
    "cotacaoIndividual": "CotacaoIndividualView",
    "contagemdeestoque": "ContagemDeEstoqueView",
    "marcarprodutos": "MarcacaoProdutosView",
    "conciliacaonf": "ConciliacaoNFView",
    "relatoriorateio": "RelatorioRateioView",
    "notasfiscais": "NotasFiscaisView",
    // Adicione outros mapeamentos aqui
  };

  const fileName = viewMap[viewName];
  
  if (!fileName) {
    console.warn(`Tentativa de acesso a view inválida: ${viewName}`);
    return res.status(404).send(`View '${viewName}' não encontrada.`);
  }

  try {
    // Renderiza o arquivo .ejs e o envia como HTML puro
    // (O EJS processa o arquivo e nos dá o HTML final)
    const html = await ejs.renderFile(path.join(__dirname, 'views', `${fileName}.ejs`));
    res.send(html);
  } catch (error) {
    console.error(`Erro ao renderizar a view ${fileName}.ejs:`, error.message);
    res.status(500).send(`Erro ao carregar a view '${viewName}'. Verifique se o arquivo 'views/${fileName}.ejs' existe.`);
  }
});

/**
 * Rota para incluir HTML (GET /include/:fileName)
 * Substitui a App_incluirHtml(). Isso é usado pelo EJS.
 *
 * NOTA: Você não precisará mais desta rota!
 * No seu 'PaginaPrincipal.ejs', você mudará:
 * De: <?!= App_incluirHtml('FornecedoresScript', true) ?>
 * Para: <%- include('FornecedoresScript') %>
 * O EJS fará isso automaticamente.
 */

// (Podemos adicionar as outras rotas do App.js depois, como /api/constantes)


// --- Iniciar o Servidor ---
app.listen(PORT, () => {
  console.log(`[CotacaoPro-Node] Servidor rodando com sucesso na porta http://localhost:${PORT}`);
  console.log(`[CotacaoPro-Node] Usando Planilha NF: ${process.env.ID_PLANILHA_NF}`);
});