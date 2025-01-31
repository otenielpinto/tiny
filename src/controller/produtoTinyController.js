async function init() {}
import { ProdutoTinyRepository } from "../repository/produtoTinyRepository.js";
import { TMongo } from "../infra/mongoClient.js";

const findAll = async (codigo, id_tenant) => {
  const c = await TMongo.connect();
  const repository = new ProdutoTinyRepository(c, id_tenant);
  return await repository.findAll({ sys_codigo: codigo, id_tenant: id_tenant });
};

const produtoTinyController = {
  init,
  findAll,
};

export { produtoTinyController };
