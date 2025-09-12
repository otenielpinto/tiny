//Classe tem letras maiuculoas

const collection = "tmp_estoque";

class EstoqueRepository {
  constructor(db, id_tenant) {
    this.db = db;
    this.id_tenant = Number(id_tenant);
  }

  async create(payload) {
    const result = await this.db.collection(collection).insertOne(payload);
    return result.insertedId;
  }

  async update(codigo, payload) {
    payload.updated_at = new Date();
    let inc = {};
    if (payload?.status === 500) {
      inc = { $inc: { error_count: 1 } };
    } else {
      payload.error_count = 0;
    }
    const result = await this.db
      .collection(collection)
      .updateOne(
        { codigo: String(codigo) },
        { $set: payload, ...inc },
        { upsert: true }
      );
    return result;
  }

  // processar novamente os itens com status 500
  async reprocessar(filter, payload) {
    payload.updated_at = new Date();
    const result = await this.db
      .collection(collection)
      .updateMany(filter, { $set: payload });
    return result;
  }

  async delete(codigo) {
    const result = await this.db
      .collection(collection)
      .deleteOne({ codigo: String(codigo) });
    return result.deletedCount > 0;
  }

  async findAll(criterio = {}) {
    return await this.db.collection(collection).find(criterio).toArray();
  }

  async findById(id) {
    return await this.db
      .collection(collection)
      .findOne({ id: Number(id), id_tenant: this.id_tenant });
  }

  async findByIdProduto(id_produto) {
    return await this.db
      .collection(collection)
      .findOne({ id_produto: Number(id_produto), id_tenant: this.id_tenant });
  }

  async insertMany(items) {
    if (!Array.isArray(items)) return null;
    try {
      return await this.db.collection(collection).insertMany(items);
    } catch (e) {
      console.log(e);
    }
  }

  async deleteMany(criterio = {}) {
    try {
      return await this.db.collection(collection).deleteMany(criterio);
    } catch (e) {
      console.log(e);
    }
  }
}

export { EstoqueRepository };
