// Importa as bibliotecas que instalamos
require('dotenv').config(); // Carrega as variáveis do .env
const express = require('express');
const path = require('path');
const cors = require('cors');
const ejs = require('ejs'); // Importamos o EJS para renderizar HTML
const { google } = require('googleapis');

// Importa nossas constantes do arquivo que acabamos de criar
const constants = require('./config/constants');

// --- Importa os roteadores da API ---
const fornecedoresRouterApi = require('./Routes/fornecedores');
const produtosRouterApi = require('./Routes/produtos'); // <<< LINHA ADICIONADA
// (Você importará os outros, como subprodutosRouterApi, aqui)


// --- Configuração do Aplicativo ---
const app = express();
const PORT = process.env.PORT || 8080;

// --- Autenticação com Google ---
// Esta função nos dará um cliente autenticado para usar as APIs
async function getAuthClient() {
  // *** CORREÇÃO: Lendo o arquivo .json diretamente ***
  // Este método é mais robusto e corrige o erro 'Invalid JWT Signature'
  // causado pelos '\n' na chave privada dentro do arquivo .env.

  // Define o caminho para o arquivo JSON da conta de serviço
  const keyFilePath = path.join(__dirname, 'cotacaopro-node-service-account.json');

  // A GoogleAuth pode carregar diretamente do caminho do arquivo
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath, // Usamos 'keyFile' em vez de 'credentials'
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return auth.getClient();
}

// --- Configuração do Servidor Express ---
app.use(cors()); // Habilita o CORS

// Configura o EJS como nosso "View Engine"
app.set('view engine', 'ejs');
// Aponta o EJS para a pasta /views
app.set('views', path.join(__dirname, 'views'));

// Permite que o servidor entenda JSON (para chamadas de API)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define a pasta /public para servir arquivos estáticos (CSS, JS de cliente, etc.)
app.use(express.static(path.join(__dirname, 'public')));


// --- Middleware de Autenticação (Injeção de Clientes) ---
// Isso roda antes de QUALQUER rota de API.
// Ele se autentica com o Google e disponibiliza os clientes (sheets, drive)
// e as constantes para todas as rotas que vierem depois.
app.use(async (req, res, next) => {
  try {
    // Se ainda não autenticamos, autentica agora.
    if (!app.locals.googleAuthClient) {
      console.log("[Auth] Autenticando com Google APIs...");
      app.locals.googleAuthClient = await getAuthClient();
      app.locals.googleSheets = google.sheets({ version: 'v4', auth: app.locals.googleAuthClient });
      app.locals.googleDrive = google.drive({ version: 'v3', auth: app.locals.googleAuthClient });
      
      // Disponibiliza os IDs das planilhas para todos os controllers
      app.locals.ID_PLANILHA_NF = process.env.ID_PLANILHA_NF;
      app.locals.ID_PLANILHA_FINANCEIRO = process.env.ID_PLANILHA_FINANCEIRO;
      app.locals.ID_PLANILHA_PRINCIPAL = process.env.ID_PLANILHA_PRINCIPAL; 
      // Disponibiliza todas as constantes
      app.locals.constants = constants;
      console.log("[Auth] Autenticado e clientes prontos.");
    }
    
    // Disponibiliza os clientes e IDs para a rota atual
    // Agora nossos arquivos de controller poderão acessar `req.sheets`, `req.drive`, etc.
    req.sheets = app.locals.googleSheets;
    req.drive = app.locals.googleDrive;
    req.ID_PLANILHA_NF = app.locals.ID_PLANILHA_NF;
    req.ID_PLANILHA_FINANCEIRO = app.locals.ID_PLANILHA_FINANCEIRO;
    req.ID_PLANILHA_PRINCIPAL = app.locals.ID_PLANILHA_PRINCIPAL;
    req.constants = app.locals.constants;
    
    // Continua para a próxima rota
    next();
  } catch (error) {
    console.error("Erro fatal na autenticação do Google:", error.message);
    res.status(500).send("Falha ao autenticar com os serviços do Google.");
  }
});


// --- ROTAS PRINCIPAIS (Migração do App.js) ---

/**
 * Rota Principal (GET /)
 * Substitui o doGet() padrão do GAS.
 * Renderiza a PaginaPrincipal.ejs.
 */
app.get('/', (req, res) => {
  // 'res.render' usa o EJS para processar o arquivo
  // O EJS irá procurar por 'views/PaginaPrincipal.ejs'
  // e o enviará como a página principal.
  res.render('PaginaPrincipal');
});

/**
 * Rota para obter Views (GET /view/:viewName)
 * Substitui a função App_obterView(viewName) do GAS.
 * É usada pelo JS da PaginaPrincipal para carregar o conteúdo das outras telas.
 */
app.get('/view/:viewName', async (req, res) => {
  const viewName = req.params.viewName;
  
  // Mapeamento migrado do App_VIEW_FILENAME_MAP
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
    "notasfiscais": "NotasFiscaisView"
    // Adicione os outros mapeamentos do seu App.js aqui
  };

  const fileName = viewMap[viewName];
  
  if (!fileName) {
    console.warn(`Tentativa de acesso a view inválida: ${viewName}`);
    return res.status(404).send(`View '${viewName}' não encontrada.`);
  }

  try {
    // Passamos o 'filename' para que o EJS saiba onde
    // encontrar os arquivos referenciados em <%- include(...) %>
    const filePath = path.join(__dirname, 'views', `${fileName}.ejs`);
    const html = await ejs.renderFile(filePath, { 
        filename: filePath 
    });
    // Enviamos o HTML puro como resposta
    res.send(html);
  } catch (error) {
    console.error(`Erro ao renderizar a view ${fileName}.ejs:`, error.message);
    res.status(500).send(`Erro ao carregar a view '${viewName}'. Verifique se o arquivo 'views/${fileName}.ejs' existe.`);
  }
});


// --- ROTAS DA API (Substituem os *Controller.js) ---
// Aqui é onde registramos os endpoints que o seu frontend chamará

// Registra o roteador importado do arquivo /Routes
app.use('/api/fornecedores', fornecedoresRouterApi);
app.use('/api/produtos', produtosRouterApi); // <<< LINHA ADICIONADA
// (Você adicionará os outros aqui, ex: app.use('/api/subprodutos', subprodutosRouterApi);)


// --- Iniciar o Servidor ---
app.listen(PORT, () => {
  console.log(`[CotacaoPro-Node] Servidor rodando com sucesso na porta http://localhost:${PORT}`);
  console.log(`[CotacaoPro-Node] Usando Planilha Principal: ${process.env.ID_PLANILHA_PRINCIPAL}`);
  console.log(`[CotacaoPro-Node] Usando Planilha NF: ${process.env.ID_PLANILHA_NF}`);
});