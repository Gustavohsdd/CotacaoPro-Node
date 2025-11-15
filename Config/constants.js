// config/constants.js
// Migrado de Constantes.js e outros arquivos que dependiam delas.

// IDs das planilhas e pastas (lidos do .env)
const ID_PLANILHA_PRINCIPAL = process.env.ID_PLANILHA_PRINCIPAL;
const ID_PLANILHA_NF = process.env.ID_PLANILHA_NF;
const ID_PLANILHA_FINANCEIRO = process.env.ID_PLANILHA_FINANCEIRO;

// Nomes de Abas Principais
const ABA_FORNECEDORES = "Fornecedores";
const ABA_PRODUTOS = "Produtos";
const ABA_SUBPRODUTOS = "SubProdutos";
const ABA_COTACOES = "Cotacoes";
const ABA_PORTAL = "Portal";
const ABA_CADASTROS = "Cadastros";
const ABA_CONCILIACAO = "Conciliacao";

// Nomes de Abas de NF (da Planilha Externa)
const ABA_NF_NOTAS_FISCAIS = 'NotasFiscais';
const ABA_NF_ITENS = 'ItensNF';
const ABA_NF_FATURAS = 'FaturasNF';
const ABA_NF_TRIBUTOS_TOTAIS = 'TributosTotaisNF';

// Nomes de Abas Financeiras (da Planilha Externa)
const ABA_FINANCEIRO_REGRAS_RATEIO = 'RegrasRateio';
const ABA_FINANCEIRO_CONTAS_A_PAGAR = 'ContasAPagar';

// Cabeçalhos (essenciais para os CRUDs)
const CABECALHOS_FORNECEDORES = [
  "Data de Cadastro", "ID", "Fornecedor", "CNPJ", "Categoria",
  "Vendedor", "Telefone", "Email", "Dias de Pedido", "Dias de Entrega",
  "Condições de Pagamento", "Dia de Faturamento", "Pedido Mínimo (R$)",
  "Regime Tributário", "Contato Financeiro"
];

const CABECALHOS_PRODUTOS = [
  "Data de Cadastro", "ID", "Produto", "ABC", "Categoria",
  "Tamanho", "UN", "Estoque Minimo", "Status"
];

const CABECALHOS_SUBPRODUTOS = [
  "Data de Cadastro", "ID", "SubProduto", "Produto Vinculado", "Categoria",
  "Fornecedor", "Tamanho", "UN", "Fator", "NCM", "CST", "CFOP", "Status"
];

const CABECALHOS_COTACOES = [
  "ID da Cotação", "Data Abertura", "Produto", "SubProduto", "Categoria",
  "Fornecedor", "Tamanho", "UN", "Fator", "Estoque Mínimo", "Estoque Atual",
  "Preço", "Preço por Fator", "Comprar", "Valor Total", "Economia em Cotação",
  "NCM", "CST", "CFOP", "Empresa Faturada", "Condição de Pagamento", 
  "Status da Cotação", "Status do SubProduto", "Quantidade Recebida", 
  "Divergencia da Nota", "Quantidade na Nota", "Preço da Nota", "Número da Nota"
];

const CABECALHOS_PORTAL = [
  "ID da Cotação",
  "Nome Fornecedor",
  "Token Acesso",
  "Link Acesso",
  "Status",
  "Data Envio",
  "Data Resposta",
  "Texto Personalizado Link"
];

const STATUS_PORTAL = {
  LINK_GERADO: "Link Gerado",
  RESPONDIDO: "Respondido",
  EM_PREENCHIMENTO: "Em Preenchimento",
  FECHADO: "Fechado",
  ERRO_PORTAL: "Erro no Portal",
  EXPIRADO: "Expirado"
};
Object.freeze(STATUS_PORTAL);

const CABECALHOS_CADASTROS = [
  "Empresas",
  "CNPJ",
  "Endereço",
  "Telefone",
  "Email",
  "Contato"
];

const CABECALHOS_NF_FATURAS = [
  "Chave de Acesso", "Número da Fatura", "Número da Parcela",
  "Data de Vencimento", "Valor da Parcela"
];

const CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR = [
  "Chave de Acesso", "Número da Fatura", "Número da Parcela", "Resumo dos Itens",
  "Data de Vencimento", "Valor da Parcela", "Setor", "Valor por Setor"
];


// Exporta tudo para ser usado em outros arquivos do Node.js
module.exports = {
  ID_PLANILHA_PRINCIPAL,
  ID_PLANILHA_NF,
  ID_PLANILHA_FINANCEIRO,
  ABA_FORNECEDORES,
  ABA_PRODUTOS,
  ABA_SUBPRODUTOS,
  ABA_COTACOES,
  ABA_PORTAL,
  ABA_CADASTROS,
  ABA_CONCILIACAO,
  ABA_NF_NOTAS_FISCAIS,
  ABA_NF_ITENS,
  ABA_NF_FATURAS,
  ABA_NF_TRIBUTOS_TOTAIS,
  ABA_FINANCEIRO_REGRAS_RATEIO,
  ABA_FINANCEIRO_CONTAS_A_PAGAR,
  CABECALHOS_FORNECEDORES,
  CABECALHOS_PRODUTOS,
  CABECALHOS_SUBPRODUTOS,
  CABECALHOS_COTACOES,
  CABECALHOS_PORTAL,
  STATUS_PORTAL,
  CABECALHOS_CADASTROS,
  CABECALHOS_NF_FATURAS,
  CABECALHOS_FINANCEIRO_CONTAS_A_PAGAR
};