import {
  ProtocoloAnuncioRepository,
  TProtocolo,
} from "../repository/protocoloAnuncioRepository.js";
import { ProtocoloAnuncioMapper } from "../mappers/protocoloAnuncioMappers.js";
import { produtoTinyController } from "./produtoTinyController.js";

import { Tiny } from "../services/tinyService.js";
import { getToken } from "./mpkIntegracaoController.js";
import { TResponseService } from "../services/responseService.js";
import { lib } from "../utils/lib.js";

async function existsProduto(body) {
  let payload = await ProtocoloAnuncioMapper.toTiny(body);
  let codigo = payload?.produto?.codigo;
  if (!codigo) return null;
  let result = null;

  let tiny = new Tiny({ token: await getToken(body).then((t) => t.token) });
  const data = [{ key: "pesquisa", value: codigo }];
  let response = await tiny.post("produtos.pesquisa.php", data);
  let produtos = await tiny.tratarRetorno(response, "produtos");

  //localizar o produto pai
  if (Array.isArray(produtos)) {
    for (let p of produtos) {
      if (p?.produto.codigo == codigo) result = p?.produto;
    }
  }

  return result;
}

const retificarAnuncio = async (req, res) => {
  const body = req?.body || {};
  let codigo = lib.onlyNumber(body.codigo);
  let id_tenant = body.id_tenant;
  let id_integracao = body.id_integracao;
  let idProdutoPai = null;
  let result = null;
  let items = await produtoTinyController.findAll(codigo, id_tenant);

  if (!Array.isArray(items)) {
    TResponseService.send(req, res, { message: "Produto não encontrado" });
    return;
  }

  for (let item of items) {
    let body = {
      id_integracao,
      id_tenant,
      id_anuncio_mktplace: item.id,
    };
    let p = await obterProdutoTiny(body);
    if (!p) {
      result = { message: `Produto ${item.id} não encontrado` };
      continue;
    }

    if (p.situacao != "A") {
      result = { message: `Produto ${p.id} foi excluido` };
      continue;
    }

    if (p.idProdutoPai) idProdutoPai = p.idProdutoPai;
    result = p;
  }

  //preciso buscar o produto pai para devolver toda a variação
  if (idProdutoPai) {
    let body = {
      id_integracao,
      id_tenant,
      id_anuncio_mktplace: idProdutoPai,
    };
    let p = await obterProdutoTiny(body);
    if (p) {
      result = p;
    }
  }

  TResponseService.send(req, res, result);
};

const create = async (req, res) => {
  const body = req?.body || {};
  let result = null;
  let response = null;

  let exists = await existsProduto(body);
  if (exists?.id) {
    body.id_anuncio_mktplace = exists?.id;
    result = exists;
  } else {
    let payload = await ProtocoloAnuncioMapper.toTiny(body);
    let tiny = new Tiny({ token: await getToken(body).then((t) => t.token) });
    const data = [{ key: "produto", value: { produtos: [payload] } }];
    response = await tiny.post("produto.incluir.php", data);
    result = await tiny.tratarRetorno(response, "registros");

    if (Array.isArray(result)) {
      for (let item of result) {
        if (item?.registro?.id) body.id_anuncio_mktplace = item?.registro?.id;
      }
    }
  }

  body.sys_recibo = result;
  await TProtocolo.reciboEnvio(body);
  TResponseService.send(req, res, result);
};

const update = async (req, res) => {
  const body = req.body;
  let payload = await ProtocoloAnuncioMapper.toTiny(body);

  let tiny = new Tiny({ token: await getToken(body).then((t) => t.token) });
  const data = [{ key: "produto", value: { produtos: [payload] } }];
  let response = await tiny.post("produto.alterar.php", data);
  let result = await tiny.tratarRetorno(response, "registros");
  if (!body?.id_anuncio_mktplace && tiny.status() == "OK") {
    if (Array.isArray(result)) {
      for (let item of result) {
        if (item?.registro?.id) body.id_anuncio_mktplace = item?.registro?.id;
      }
    }
  }
  body.sys_recibo = result;
  await TProtocolo.reciboEnvio(body);
  TResponseService.send(req, res, result);
};

const get = async (req, res) => {
  TResponseService.send(
    req,
    res,
    await TProtocolo.obterAnuncio(req.params.codigo)
  );
};

const updateAnuncio = async (req, res) => {
  const updateAnuncio = await atualizarAnuncioWithTiny(req.params.codigo);
  TResponseService.send(req, res, updateAnuncio);
};

async function atualizarAnuncioWithTiny(codigo) {
  let anuncio = await TProtocolo.obterAnuncio(codigo);
  let id_tiny = anuncio?.id_anuncio_mktplace;
  if (!id_tiny) return anuncio;
  let variacoes = anuncio?.variacoes;

  const params = {
    id_anuncio_mktplace: id_tiny,
    id_tenant: anuncio?.id_tenant,
    id_integracao: anuncio?.id_integracao,
  };
  const produto = await obterProdutoTiny(params);
  const newVariacoes = await updateVariacoes(produto, variacoes);

  anuncio.id_anuncio_mktplace = id_tiny;
  anuncio.variacoes = newVariacoes;
  TProtocolo.reciboEnvio(anuncio);
  return anuncio;
}

async function updateVariacoes(produtoTiny, variacoes) {
  const sys_variacoes = produtoTiny?.variacoes;
  if (!variacoes || !Array.isArray(sys_variacoes)) return variacoes;
  for (let v of variacoes) {
    let item = null;
    for (let sys of sys_variacoes) {
      if (String(sys?.variacao?.codigo) === String(v?.id_produto)) {
        item = sys;
        break;
      }
    }

    if (item) {
      v.id_variant_mktplace = item?.variacao?.id;
      v.id_anuncio_mktplace = produtoTiny?.id;
    }
  }
  return variacoes;
}

async function obterProdutoTiny(body) {
  //Precisa ter id_tenant , id_integracao e id_anuncio_mktplace
  let tiny = new Tiny({ token: await getToken(body).then((t) => t.token) });
  const data = [{ key: "id", value: body.id_anuncio_mktplace }];
  let result = await tiny.post("produto.obter.php", data);
  return await tiny.tratarRetorno(result, "produto");
}

const doDelete = async (req, res) => {
  const deleteAnuncio = await TProtocolo.deleteAnuncio(req.params.codigo);
  TResponseService.send(req, res, deleteAnuncio);
};

const protocoloAnuncioController = {
  retificarAnuncio,
  updateAnuncio,
  create,
  update,
  get,
  doDelete,
};

export { protocoloAnuncioController };
