import { lib } from "../utils/lib.js";
import { AnuncioRepository } from "../repository/anuncioRepository.js";
import { Tiny } from "../services/tinyServices.js";
import { TMongo } from "../infra/mongoClient.js";
import { ProdutoTinyRepository } from "../repository/produtoTinyRepository.js";
import { EstoqueRepository } from "../repository/estoqueRepository.js";

async function init() {
  await retificarEstoque();
}

async function importarProdutoTiny() {
  let produtoTinyRepository = new ProdutoTinyRepository(
    await TMongo.connect(),
    process.env.CONFIG_ID_TENANT
  );

  const tiny = new Tiny({ token: process.env.TINY_TOKEN });
  let page = 1;
  let data = [
    { key: "pesquisa", value: "" },
    { key: "pagina", value: page },
  ];
  let result = await tiny.post("produtos.pesquisa.php", data);
  let page_count = result?.data?.retorno?.numero_paginas;

  let response;
  for (let page = page_count; page > 0; page--) {
    data = [
      { key: "pesquisa", value: "" },
      { key: "pagina", value: page },
    ];
    result = null;
    response = null;

    for (let t = 1; t < 5; t++) {
      //mensagem informando numero de paginal do total e numero de tentativa
      console.log(
        "Tentativa: " + t + "  Paginas : " + page_count + " of " + page
      );
      result = await tiny.post("produtos.pesquisa.php", data);
      response = await lib.tratarRetorno(result, "produtos");
      if (!response) continue;
      break;
    }
    let lote = [];
    if (!Array.isArray(response)) continue;
    for (let item of response) {
      lote.push({ ...item.produto });
    }

    for (let item of lote) {
      await produtoTinyRepository.update(item.id, item);
    }
  }
}

async function retificarEstoque() {
  let id_tenant = Number(process.env.CONFIG_ID_TENANT);
  const prodTinyRepository = new ProdutoTinyRepository(
    await TMongo.connect(),
    id_tenant
  );
  let estoqueRepository = new EstoqueRepository(
    await TMongo.connect(),
    id_tenant
  );
  const tiny = new Tiny({ token: process.env.TINY_TOKEN });

  const produtos = await prodTinyRepository.findAll({
    sys_status: 0,
    id_tenant: id_tenant,
  });

  for (let produto of produtos) {
    let data = [{ key: "id", value: produto.id }];
    let response = null;
    let result;

    for (let t = 1; t < 5; t++) {
      console.log("Obtendo estoque " + t + "/5 Prod:" + produto.id);
      result = await tiny.post("produto.obter.estoque.php", data);
      response = await lib.tratarRetorno(result, "produto");
      if (!response) continue;
      break;
    }
    if (!response) continue;

    let saldo = 0;
    saldo = response?.saldo ? response?.saldo : 0;
    response = await estoqueRepository.findByIdProduto(
      Number(lib.onlyNumber(produto.codigo))
    );

    let qt_estoque = 0;
    qt_estoque = response?.estoque ? response?.estoque : 0;

    console.log("Estoque: " + qt_estoque + " Saldo: " + saldo);
    if (qt_estoque != saldo) {
      console.log("atualizar estoque no tiny");
      continue;
    }

    produto.sys_status = 1;
    await prodTinyRepository.update(produto.id, produto);
  }
}

const AnuncioController = {
  init,
};

export { AnuncioController };
