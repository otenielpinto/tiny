import { lib } from "../utils/lib.js";
import { Tiny } from "../services/tinyService.js";
import { TMongo } from "../infra/mongoClient.js";
import { EstoqueRepository } from "../repository/estoqueRepository.js";
import { ProdutoTinyRepository } from "../repository/produtoTinyRepository.js";
import { logService } from "../services/logService.js";
import { getToken } from "./mpkIntegracaoController.js";
import { array } from "zod";

async function init() {
  //fazer uma atualizacao dos status =500  e tambem de todos que estão situacao =0
}

//idProduto = id Tiny do Produto
async function produtoAtualizarEstoque(token, id_produto, quantity) {
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

  const tiny = new Tiny({ token: token });
  tiny.setTimeout(1000 * 10);
  let response = null;
  const data = [{ key: "estoque", value: { estoque } }];

  for (let t = 1; t < 5; t++) {
    console.log(
      "Atualizando estoque " + t + "/5  " + id_produto + " qtd: " + quantity,
    );
    response = await tiny.post("produto.atualizar.estoque.php", data);
    response = await tiny.tratarRetorno(response, "registros");
    if (tiny.status() == "OK") return response;
    response = null;
  }

  return response;
}

async function atualizarPrecosLote(tenant, produtos) {
  const tiny = new Tiny({ token: tenant.token });
  tiny.setTimeout(1000 * 10);
  let response = null;

  let obj = {
    precos: produtos,
  };
  const data = [{ key: "data", value: obj }];

  for (let t = 1; t < 5; t++) {
    console.log("Atualizando precos em lote " + t + "/5  ");
    response = await tiny.post("produto.atualizar.precos.php", data);
    response = await tiny.tratarRetorno(response, "registros");

    if (tiny.status() == "OK") return response;
    response = null;
  }

  return response;
}

async function zerarEstoqueGeral(tenant) {
  let c = await TMongo.connect();
  let produtoTinyRepository = new ProdutoTinyRepository(c, tenant.id_tenant);
  let criterio = {
    id_tenant: tenant.id_tenant,
    sys_status: 0,
  };

  let rows = await produtoTinyRepository.findAll(criterio);
  for (let row of rows) {
    console.log("Zerando estoque geral " + row.id + " " + row.codigo);
    let quantidade = 0;
    await produtoAtualizarEstoque(tenant.token, row.id, quantidade);
    row.sys_status = 1;
    await produtoTinyRepository.update(row.id, row);
  }
}

const update = async (req, res) => {
  //Precisa ter id_tenant , id_integracao
  let obj = req.body || {};
  if (Array.isArray(obj)) obj = obj[0] || {};

  let token = await getToken(obj).then((t) => t.token);

  //espera um array de objetos {id_tenant, id_produto, estoque}

  let rows = req.body || [];
  if (!Array.isArray(rows)) rows = [];
  if (rows.length == 0) {
    return res.status(400).send({
      message: "Por favor informe os dados para atualizar o estoque",
    });
  }
  let result = [];
  const c = await TMongo.connect();

  for (let row of rows) {
    let id_tenant = Number(row?.id_tenant);

    if (!row.id_tenant) {
      return res.status(400).send({
        message: "Por favor informe o id_tenant",
      });
    }

    if (!row.id_produto) {
      return res.status(400).send({
        message: "Por favor informe o id_produto",
      });
    }

    if (row?.estoque == null || isNaN(row.estoque)) {
      return res.status(400).send({
        message: "Por favor informe a quantidade",
      });
    }
    let prodTinyRepository = new ProdutoTinyRepository(c, id_tenant);
    let sku = row?.id_produto;
    let estoque = Number(row?.estoque);
    let r = null;

    //aqui vou pesquisar na lista de produtos importados do tiny o id do tiny
    //nao posso usar o id que vem na tabela de estoques porques o tiny muda o id no agrupamento de anuncio ....
    let produtos = await prodTinyRepository.findAll({
      sys_codigo: String(sku),
      id_tenant: id_tenant,
    });
    if (!Array.isArray(produtos) || produtos.length == 0) {
      produtos = [];
      console.log(
        "Produto não encontrado no tenant " + id_tenant + " id_produto: " + sku,
      );
      r = await produtoAtualizarEstoque(
        token,
        row?.id_variant_mktplace,
        estoque,
      );
      result.push(r);
    }

    for (let p of produtos) {
      try {
        r = await produtoAtualizarEstoque(token, p.id, estoque);
      } catch (error) {
        console.log(
          `Erro ao atualizar estoque do produto ${sku} - ${error.message}`,
        );
        return res.status(500).send({
          message: `Erro ao atualizar estoque do produto ${sku} - ${error.message}`,
        });
      }
      result.push(r);

      //Testar se id_variant é diferente do p.id
      if (p?.id != row?.id_variant_mktplace) {
        r = await produtoAtualizarEstoque(
          token,
          p.id_variant_mktplace,
          estoque,
        );
        result.push(r);
      }
    }
  }

  res.send(result);
};

const estoqueController = {
  init,
  produtoAtualizarEstoque,
  zerarEstoqueGeral,
  atualizarPrecosLote,
  update,
};

export { estoqueController };
