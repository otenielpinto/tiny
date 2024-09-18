import { lib } from "../utils/lib.js";
import { AnuncioRepository } from "../repository/anuncioRepository.js";
import { Tiny } from "../services/tinyService.js";
import { TMongo } from "../infra/mongoClient.js";
import { ProdutoTinyRepository } from "../repository/produtoTinyRepository.js";
import { EstoqueRepository } from "../repository/estoqueRepository.js";
import { estoqueController } from "./estoqueController.js";
import { marketplaceTypes } from "../types/marketplaceTypes.js";
import { systemService } from "../services/systemService.js";
import { mpkIntegracaoController } from "./mpkIntegracaoController.js";

var filterTiny = {
  id_mktplace: marketplaceTypes.tiny,
};

async function init() {
  await importarProdutoTiny();
  await updateAnuncios();

  //tem que ser por ultimo porque depende de updateAnuncios
  await enviarEstoqueEcommerce();
}

async function enviarEstoqueEcommerce() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);
  for (let tenant of tenants) {
    console.log("Inicio do processamento do estoque Servidor Tiny do tenant " + tenant.id_tenant);
    await retificarEstoqueByTenant(tenant);
    console.log("Fim do processamento do estoque Servidor Tiny do tenant " + tenant.id_tenant);
  }
}

async function updateAnunciosByTenant(tenant) {
  const c = await TMongo.connect();
  let anuncioRepository = new AnuncioRepository(c, tenant.id_tenant);

  let where = {
    id_tenant: tenant.id_tenant,
    id_marketplace: tenant.id_mktplace,
    status: 0,
  };
  let rows = await anuncioRepository.findAll(where);
  await estoqueController.updateEstoqueLoteByTenant(tenant, rows);
}

async function updateAnuncios() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);
  for (let tenant of tenants) {
    console.log("Inicio do processamento do tenant " + tenant.id_tenant);
    await updateAnunciosByTenant(tenant);
    console.log("Fim do processamento do tenant " + tenant.id_tenant);
  }
}

async function importarProdutoTinyByTenant(tenant) {
  let produtoTinyRepository = new ProdutoTinyRepository(
    await TMongo.connect(),
    tenant.id_tenant
  );

  const tiny = new Tiny({ token: tenant.token });
  tiny.setTimeout(1000 * 10);
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
      console.log(
        "Tentativa: " + t + "  Paginas: " + page_count + " de " + page
      );
      result = await tiny.post("produtos.pesquisa.php", data);
      response = await tiny.tratarRetorno(result, "produtos");
      if (tiny.status() == "OK") break;
      response = null;
    }
    let lote = [];
    if (!Array.isArray(response)) continue;
    for (let item of response) {
      lote.push({ ...item.produto, sys_status: 1 });
    }

    for (let item of lote) {
      //atualiza o preco de venda
      await produtoTinyRepository.update(item.id, item);
    }
  }
}

async function importarProdutoTiny() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);

  let key = "importarProdutoTiny";
  for (let tenant of tenants) {
    if ((await systemService.started(tenant.id_tenant, key)) == 1) continue;
    await importarProdutoTinyByTenant(tenant);
  }
}

async function retificarEstoqueByTenant(tenant) {
  const c = await TMongo.connect();
  let id_tenant = Number(tenant.id_tenant);
  const prodTinyRepository = new ProdutoTinyRepository(c, id_tenant);
  const estoqueRepository = new EstoqueRepository(c, id_tenant);
  const tiny = new Tiny({ token: tenant.token });
  tiny.setTimeout(1000 * 10);

  const produtos = await prodTinyRepository.findAll({
    sys_status: 0,
    id_tenant: id_tenant,
  });
  let separador = '*'.repeat(100);

  let response = null;
  let status = 1;
  for (let produto of produtos) {
    let data = [{ key: "id", value: produto.id }];
    response = null;
    status = 1;

    for (let t = 1; t < 5; t++) {
      response = await tiny.post("produto.obter.estoque.php", data);
      response = await tiny.tratarRetorno(response, "produto");
      if (tiny.status() == "OK") break;
      response = null;
    }


    if (!response) {
      produto.sys_status = 500;
      await prodTinyRepository.update(produto.id, produto);
      continue;
    }
    let saldo = Number(response?.saldo ? response?.saldo : 0);
    let qt_estoque = 0;

    if (!produto.sys_estoque) {
      response = await estoqueRepository.findByIdProduto(
        Number(lib.onlyNumber(produto.codigo))
      );
      qt_estoque = Number(response?.estoque ? response?.estoque : 0);
    } else {
      qt_estoque = Number(produto?.sys_estoque ? produto?.sys_estoque : 0);
    }
    let p = produto?.codigo;
    let t = produto?.tipoVariacao;
    console.log(`Estoque:${qt_estoque} EstoqueTiny:${saldo} ${t} P=${p}`);

    if (qt_estoque != saldo && produto.tipoVariacao != "P") {
      response = await estoqueController.produtoAtualizarEstoque(
        tenant.token,
        produto.id,
        qt_estoque
      );

      if (response?.registro?.status != "OK") status = 500;
    }
    console.log(separador);

    produto.sys_status = status;
    if (produto.sys_status == 500) {
      console.log(separador);
      console.log("Produto nao atualizado no Tiny " + produto.id);
      console.log(separador);
    }

    await prodTinyRepository.update(produto.id, produto);
  } //for produtos
}

const AnuncioController = {
  init,
};

export { AnuncioController };
