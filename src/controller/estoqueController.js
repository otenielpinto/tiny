import { lib } from "../utils/lib.js";
import { Tiny } from "../services/tinyServices.js";

async function init() {}

//idProduto = id Tiny do Produto
async function produtoAtualizarEstoque(id_tenant, id_produto, quantity) {
  let date = new Date();
  let hora = date.getHours(); // 0-23
  let min = date.getMinutes(); // 0-59
  let seg = date.getSeconds(); // 0-59
  let minFmt = min;
  if (min < 10) minFmt = `0${min}`;
  if (quantity < 0) quantity = 0;

  let obs =
    `Estoque Movimentado : ${quantity} as ` +
    lib.formatDateBr(date) +
    ` ${hora}:${minFmt}:${seg} by T7Ti `;

  const estoque = {
    idProduto: id_produto,
    tipo: "B",
    observacoes: obs,
    quantidade: quantity,
  };

  const tiny = new Tiny({ token: process.env.TINY_TOKEN });
  let response = null;
  const data = [{ key: "estoque", value: { estoque } }];

  for (let t = 1; t < 5; t++) {
    console.log("Atualizando estoque " + t + "/5 Prod:" + id_produto);
    response = await tiny.post("produto.atualizar.estoque.php", data);
    response = await lib.tratarRetorno(response, "registros");
    if (!response) continue;
    break;
  }

  return response;
}

const estoqueController = {
  init,
  produtoAtualizarEstoque,
};

export { estoqueController };
