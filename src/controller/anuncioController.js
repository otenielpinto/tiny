import { lib } from "../utils/lib.js";
import { AnuncioRepository } from "../repository/anuncioRepository.js";
import { Tiny } from "../services/tinyServices.js";
import { TMongo } from "../infra/mongoClient.js";
import { ProdutoTinyRepository } from "../repository/produtoTinyRepository.js";
import { EstoqueRepository } from "../repository/estoqueRepository.js";
import { estoqueController } from "./estoqueController.js";
import { marketplaceTypes } from "../types/marketplaceTypes.js";
import { tenantController } from "./tenantController.js";
import { systemService } from "../services/systemService.js";

async function init() {
  await importarProdutoTiny();
  await updateAnuncios();
  await enviarEstoqueEcommerce();
}

async function enviarEstoqueEcommerce() {
  let tenants = await tenantController.findByMarkeplace(marketplaceTypes.tiny);
  for (let tenant of tenants) {
    await retificarEstoqueByTenant(tenant);
  }
}

async function updateAnunciosByTenant(tenant) {
  let anuncioRepository = new AnuncioRepository(
    await TMongo.connect(),
    tenant.id_tenant
  );

  let where = {
    id_tenant: tenant.id_tenant,
    id_marketplace: tenant.id_marketplace,
    status: 0,
  };

  let rows = await anuncioRepository.findAll(where);
  await estoqueController.updateEstoqueLoteByTenant(tenant, rows);
}

async function updateAnuncios() {
  let tenants = await tenantController.findByMarkeplace(marketplaceTypes.tiny);
  for (let tenant of tenants) {
    await updateAnunciosByTenant(tenant);
  }
}

async function importarProdutoTinyByTenant(tenant) {
  let produtoTinyRepository = new ProdutoTinyRepository(
    await TMongo.connect(),
    tenant.id_tenant
  );

  const tiny = new Tiny({ token: tenant.token });
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
      response = await lib.tratarRetorno(result, "produtos");
      if (!response) continue;
      break;
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
  let tenants = await tenantController.findByMarkeplace(marketplaceTypes.tiny);
  let key = "importarProdutoTiny";
  for (let tenant of tenants) {
    if ((await systemService.started(tenant.id_tenant, key)) == 1) continue;
    await importarProdutoTinyByTenant(tenant);
  }
}
async function retificarEstoque() {
  let tenants = await tenantController.findByMarkeplace(marketplaceTypes.tiny);
  for (let tenant of tenants) {
    await retificarEstoqueByTenant(tenant);
  }
}

async function retificarEstoqueByTenant(tenant) {
  let id_tenant = Number(tenant.id_tenant);
  const prodTinyRepository = new ProdutoTinyRepository(
    await TMongo.connect(),
    id_tenant
  );
  let estoqueRepository = new EstoqueRepository(
    await TMongo.connect(),
    id_tenant
  );
  const tiny = new Tiny({ token: tenant.token });

  const produtos = await prodTinyRepository.findAll({
    sys_status: 0,
    id_tenant: id_tenant,
  });

  for (let produto of produtos) {
    let data = [{ key: "id", value: produto.id }];
    let response = null;

    for (let t = 1; t < 5; t++) {
      console.log("Obtendo estoque " + t + "/5 Prod:" + produto.id);
      response = await tiny.post("produto.obter.estoque.php", data);
      response = await lib.tratarRetorno(response, "produto");
      if (!response) continue;
      break;
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

    console.log(`Estoque:${qt_estoque} Saldo:${saldo} ${produto.tipoVariacao}`);

    if (qt_estoque != saldo && produto.tipoVariacao != "P") {
      response = await estoqueController.produtoAtualizarEstoque(
        tenant.token,
        produto.id,
        qt_estoque
      );

      if (response?.registro?.status != "OK") {
        produto.sys_status = 500;
        await prodTinyRepository.update(produto.id, produto);
        continue;
      }
    }

    produto.sys_status = 1;
    await prodTinyRepository.update(produto.id, produto);
  }
}

const AnuncioController = {
  init,
};

export { AnuncioController };
