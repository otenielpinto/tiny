import { lib } from "../utils/lib.js";
import { TMongo } from "../infra/mongoClient.js";
import { TenantRepository } from "../repository/tenantRepository.js";
import { marketplaceTypes } from "../types/marketplaceTypes.js";

async function init() {}

async function createTenant() {
  let tenantRepository = new TenantRepository(await TMongo.connect());
  let result = await tenantRepository.create({
    id: 100,
    descricao: "Api Tiny ERP",
    id_marketplace: marketplaceTypes.tiny,
    id_tenant: 1002,
    base_url: "",
    client_id: "",
    client_secret: "",
    app_key: "",
    app_secret: "",
    token: "",
    tabela_preco: 1,
    sellerid: "",
    max_anuncio: 0,
    id_storage: "",
    excluido: 0,
  });
  return result;
}

async function findByMarkeplace(id_marketplace) {
  let tenantRepository = new TenantRepository(await TMongo.connect());
  let where = {
    id_marketplace: id_marketplace,
    excluido: 0,
  };
  return await tenantRepository.findAll(where);
}

const tenantController = {
  init,
  findByMarkeplace,
};

export { tenantController };
