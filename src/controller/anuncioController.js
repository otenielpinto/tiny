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
import { FilaEstoqueRepository } from "../repository/filaEstoqueRepository.js";

//Essa variavel global é perigosa , mas vou manter a estrategia . Sei que nao devo usar !
var filterTiny = {
  id_mktplace: marketplaceTypes.tiny,
};

async function init() {
  if (global.config_debug == 1) {
    return;
    await atualizarEstoque();
    return;
  }

  //carga geral todos os dias 1 x ao dia
  await importarProdutoTiny();

  //exclua todos os produtos que foram excluido do tiny 1 x ao dia
  await excluirProdutoTiny();

  //atualizar novos produtos cadastrados no tiny  5 minutos
  await importarProdutoTinyDiario();

  //zerar estoque geral  (provisorio 26-09-2024 )
  // await zerarEstoqueGeralTiny();

  //atualizar estoque ecommerce ( prioridade é o estoque )
  await atualizarEstoque();

  //atualizar precos em lote
  await atualizarPrecoVenda();
}

async function zerarEstoqueGeralTiny() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);
  for (let tenant of tenants) {
    console.log(
      "Inicio do processamento do zerar estoque geral do tenant " +
        tenant.id_tenant
    );
    await estoqueController.zerarEstoqueGeral(tenant);
    console.log(
      "Fim do processamento do estoque Servidor Tiny do tenant " +
        tenant.id_tenant
    );
  }
}

async function importarProdutoTinyDiario() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);
  var hoje = lib.formatDateBr(new Date());
  const c = await TMongo.connect();

  for (let tenant of tenants) {
    let response = await produtoPesquisaByDataCriacao(tenant, hoje);
    if (!Array.isArray(response)) continue;
    let produtoTinyRepository = new ProdutoTinyRepository(c, tenant.id_tenant);

    for (let item of response) {
      let obj = item?.produto ? item?.produto : {};
      if (!obj?.id) continue;
      await produtoTinyRepository.update(obj?.id, obj);
    }
  }
}

async function atualizarPrecoVenda() {
  //obtenho os tenants
  let tenants = await mpkIntegracaoController.findAll(filterTiny);
  let max_lote = 20;
  const c = await TMongo.connect();

  //Limitar o tempo de processamento para 5 minutos
  const startTime = Date.now();
  const maxDuration = 4 * 60 * 1000; // 4 minutes in milliseconds

  //para cada tenant , atualizo os preços
  for (let tenant of tenants) {
    let anuncioRepository = new AnuncioRepository(c, tenant.id_tenant);
    let where = {
      id_tenant: tenant.id_tenant,
      id_marketplace: tenant.id_mktplace,
      status: 0,
    };

    //obtenho todos os anuncios para atualizar
    let precos = [];
    let lotes = [];
    let lista = [];
    let rows = await anuncioRepository.findAll(where);

    //aqui faço a atualizacao de preços pelo codigo do anuncio ---> Mas ele pode esta errado devido ao agrupamento de produtos
    //portanto preciso identificar o produto e atualizar também pelo campo id_produto .
    for (let row of rows) {
      if (row?.id_anuncio_mktplace) {
        lotes.push(row);
        precos.push({
          id: String(row.id_anuncio_mktplace),
          preco: String(row.preco),
          preco_promocional: String(row.preco_promocional),
        });
      }

      if (Date.now() - startTime > maxDuration) {
        console.log("Tempo excedido. Saindo do loop principal.");
        break;
      }

      //Coleto o sku dos produtos  para forçar uma atualização
      lista.push({
        sku: row.sku,
        preco: String(row.preco),
        preco_promocional: String(row.preco_promocional),
      });

      if (precos.length == max_lote) {
        await estoqueController.atualizarPrecosLote(tenant, precos);
        lotes = await processarLote(anuncioRepository, lotes);
        precos = [];
      }
    }
    //ultima linha de processamento
    if (precos.length > 0) {
      await estoqueController.atualizarPrecosLote(tenant, precos);
      lotes = await processarLote(anuncioRepository, lotes);
    }
    //------------------------------------------------------------------------------
    //aqui faça atualizacao pela lista de sku ( busco o id do anuncio  x sku )
    const prodTinyRepository = new ProdutoTinyRepository(c, tenant.id_tenant);
    precos = [];
    for (let l of lista) {
      let items = await prodTinyRepository.findAll({
        sys_codigo: l.sku,
        id_tenant: tenant.id_tenant,
      });
      if (!items) continue;

      for (let i of items) {
        precos.push({
          id: String(i.id),
          preco: String(i.preco),
          preco_promocional: String(i.preco_promocional),
        });

        if (precos.length == max_lote) {
          await estoqueController.atualizarPrecosLote(tenant, precos);
          precos = [];
        }
      }
    }

    //ultima linha de processamento
    if (precos.length > 0) {
      await estoqueController.atualizarPrecosLote(tenant, precos);
    }
  } //for do tenant
}

async function processarLote(anuncioRepository, lotes) {
  for (let row of lotes) {
    row.status = 1;
    await anuncioRepository.update(row.id, row);
  }
  return [];
}

async function atualizarEstoque() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);
  for (let tenant of tenants) {
    console.log(
      "Inicio do processamento do estoque Servidor Tiny do tenant " +
        tenant.id_tenant
    );

    await processarEstoqueByTenant(tenant);
    console.log(
      "Fim do processamento do estoque Servidor Tiny do tenant " +
        tenant.id_tenant
    );
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

    if (!Array.isArray(response)) continue;
    for (let item of response) {
      let obj = item?.produto ? item?.produto : {};
      if (!obj?.id) continue;
      await produtoTinyRepository.update(obj.id, obj);
    }
  }
}

async function excluirProdutoTiny() {
  let tenants = await mpkIntegracaoController.findAll(filterTiny);

  let key = "excluirProdutoTiny";
  for (let tenant of tenants) {
    if ((await systemService.started(tenant.id_tenant, key)) == 1) continue;
    await excluirProdutoTinyByTenant(tenant);
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

async function obterProdutoEstoque(tiny, id) {
  let data = [{ key: "id", value: id }];
  let response = null;

  for (let t = 1; t < 5; t++) {
    response = await tiny.post("produto.obter.estoque.php", data);
    response = await tiny.tratarRetorno(response, "produto");
    if (tiny.status() == "OK") break;
    response = null;
  }
  return response;
}

async function produtoPesquisaByDataCriacao(tenant, dataCriacao) {
  const data = [{ key: "dataCriacao", value: dataCriacao }];
  let response = null;

  const tiny = new Tiny({ token: tenant.token });
  tiny.setTimeout(1000 * 10);

  for (let t = 1; t < 5; t++) {
    response = await tiny.post("produtos.pesquisa.php", data);
    response = await tiny.tratarRetorno(response, "produtos");
    if (tiny.status() == "OK") break;
    response = null;
  }
  return response;
}

async function processarEstoqueByTenant(tenant) {
  const startTime = Date.now();
  const maxDuration = 4 * 60 * 1000; // 4 minutes in milliseconds

  //abrir uma conexao com mongodb
  const c = await TMongo.connect();
  let id_tenant = Number(tenant.id_tenant);

  //database
  const prodTinyRepository = new ProdutoTinyRepository(c, id_tenant);
  const estoqueRepository = new EstoqueRepository(c, id_tenant);
  const filaRepository = new FilaEstoqueRepository(c);

  //interface comunicacao com api
  const tiny = new Tiny({ token: tenant.token });
  tiny.setTimeout(1000 * 10);

  //aqui vou buscar os produtos que estao pendentes de atualizacao  situacao = 0
  const estoques = await estoqueRepository.findAll({
    status: 0,
    id_tenant: id_tenant,
  });

  //estou varrendo o estoque
  for (let e of estoques) {
    // if (Date.now() - startTime > maxDuration) {
    //   console.log("Tempo excedido. Saindo do loop principal.");
    //   break;
    // }

    let id_produto = e.id_produto;
    let qt_estoque = e.estoque ? e.estoque : 0;

    //aqui vou pesquisar na lista de produtos importados do tiny o id do tiny
    //nao posso usar o id que vem na tabela de estoques porques o tiny muda o id no agrupamento de anuncio ....
    let produtos = await prodTinyRepository.findAll({
      sys_codigo: String(id_produto),
      id_tenant: id_tenant,
    });

    //otenho a lista de produtos cadastrado  conforme mapeamento
    let response = null;
    let status = 200;
    for (let p of produtos) {
      //obtenho o estoque no tiny
      response = await obterProdutoEstoque(tiny, p.id);
      let saldo_tiny = Number(response?.saldo ? response?.saldo : 0);
      status = 200;

      if (qt_estoque != saldo_tiny && p.tipoVariacao != "P") {
        response = await estoqueController.produtoAtualizarEstoque(
          tenant.token,
          p.id,
          qt_estoque
        );

        if (response?.registro?.status != "OK") status = 500;
      }

      e.updated_at = new Date();
      if (status == 200) {
        e.status = 1; // 0- processar  1 - processado   10-concluido
        await estoqueRepository.update(e.codigo, e);
      }

      if (status == 500) {
        await filaRepository.insertMany([e]);
        e.status = 500;
        await estoqueRepository.update(e.codigo, e);
      }
    }
  }
}

async function excluirProdutoTinyByTenant(tenant) {
  let produtoTinyRepository = new ProdutoTinyRepository(
    await TMongo.connect(),
    tenant.id_tenant
  );

  const tiny = new Tiny({ token: tenant.token });
  tiny.setTimeout(1000 * 10);
  let page = 1;
  let data = [
    { key: "pesquisa", value: "" },
    { key: "situacao", value: "E" },
    { key: "pagina", value: page },
  ];
  let result = await tiny.post("produtos.pesquisa.php", data);
  let page_count = result?.data?.retorno?.numero_paginas;

  let response;
  for (let page = page_count; page > 0; page--) {
    data = [
      { key: "pesquisa", value: "" },
      { key: "situacao", value: "E" },
      { key: "pagina", value: page },
    ];
    result = null;
    response = null;

    for (let t = 1; t < 5; t++) {
      console.log(
        "Tentativa: " + t + "  Paginas: " + page + " de " + page_count
      );
      result = await tiny.post("produtos.pesquisa.php", data);
      response = await tiny.tratarRetorno(result, "produtos");
      if (tiny.status() == "OK") break;
      response = null;
    }

    if (!Array.isArray(response)) continue;
    for (let item of response) {
      let obj = item?.produto ? item?.produto : {};
      if (!obj?.id) continue;
      console.log("Excluindo produto ", obj.id);
      await produtoTinyRepository.delete(obj.id);
    }
  }
}

const AnuncioController = {
  init,
};

export { AnuncioController };
