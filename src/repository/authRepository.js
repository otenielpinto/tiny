//Classe tem letras maiuculoas
import { TMongo } from "../infra/mongoClient.js";
const collection = "auth_tenant";

class AuthRepository {
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
    let obj = this.findById(payload?.id);
    if (obj) return null;
    const result = await this.db.collection(collection).insertOne(payload);
    return result.insertedId;
  }

  async update(id, payload) {
    await this._getConnection();
    const result = await this.db
      .collection(collection)
      .updateOne({ id: Number(id) }, { $set: payload }, { upsert: true });
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

  async validateCredentials(client_id, client_secret) {
    await this._getConnection();
    return await this.db
      .collection(collection)
      .findOne({ client_id, client_secret });
  }

  async findById(id) {
    await this._getConnection();
    return await this.db.collection(collection).findOne({ id: Number(id) });
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

export { AuthRepository };
