//Classe tem letras maiuculoas
import { TMongo } from "../infra/mongoClient.js";
const collection = "mpk_integracao";

class MpkIntegracaoRepository {
  constructor() {
    this.db = null;
  }

  // Método interno para obter conexão com o banco
  async _getConnection() {
    if (!this.db) {
      this.db = await TMongo.connect();
    }
    return this.db;
  }

  async create(payload) {
    await this._getConnection();
    let codigo = payload?.codigo;
    if (codigo) {
      return this.update(codigo, payload);
    }
    const result = await this.db.collection(collection).insertOne(payload);
    return result.insertedId;
  }

  async update(codigo, payload) {
    await this._getConnection();
    const result = await this.db
      .collection(collection)
      .updateOne(
        { codigo: String(codigo) },
        { $set: payload },
        { upsert: true }
      );
    return result.modifiedCount > 0;
  }

  async delete(id) {
    await this._getConnection();
    const result = await this.db
      .collection(collection)
      .deleteOne({ id: Number(id) });
    return result.deletedCount > 0;
  }

  async findAll(criterio = {}) {
    await this._getConnection();
    return await this.db.collection(collection).find(criterio).toArray();
  }

  async findById(id) {
    await this._getConnection();
    return await this.db.collection(collection).findOne({ id: Number(id) });
  }

  async findByCodigo(codigo) {
    await this._getConnection();
    return await this.db
      .collection(collection)
      .findOne({ codigo: String(codigo) });
  }
  async findOne(criterio = {}) {
    await this._getConnection();
    return await this.db.collection(collection).findOne(criterio);
  }

  async insertMany(items) {
    await this._getConnection();
    if (!Array.isArray(items)) return null;
    try {
      return await this.db.collection(collection).insertMany(items);
    } catch (e) {
      console.log(e);
    }
  }

  async deleteMany(criterio = {}) {
    await this._getConnection();
    try {
      return await this.db.collection(collection).deleteMany(criterio);
    } catch (e) {
      console.log(e);
    }
  }
}

export { MpkIntegracaoRepository };
