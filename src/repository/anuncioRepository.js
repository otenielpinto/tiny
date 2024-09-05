//Classe tem letras maiuculoas

const collection = "mpk_anuncio";

class MpkAnuncio {
  constructor(db) {
    this.db = db;
  }

  async create(payload) {
    const result = await this.db.collection(collection).insertOne(payload);
    return result.insertedId;
  }

  async update(id, payload) {
    const result = await this.db
      .collection(collection)
      .updateOne({ id: Number(id) }, { $set: payload }, { upsert: true });
    return result.modifiedCount > 0;
  }

  async delete(id) {
    const result = await this.db
      .collection(collection)
      .deleteOne({ id: Number(id) });
    return result.deletedCount > 0;
  }

  async findAll(criterio = {}) {
    return await this.db.collection(collection).find(criterio).toArray();
  }

  async findById(id) {
    return await this.db.collection(collection).findOne({ id: Number(id) });
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

  async findAllByIds(criterio = {}) {
    let queryObject = criterio;
    let sort = { id: 1 };

    const rows = await this.db
      .collection(collection)
      .aggregate([
        {
          $match: queryObject,
        },
        //second stage
        {
          $group: {
            _id: "$_id",
            id: { $first: "$id" },
            sku: { $first: "$sku" },
          },
        },

        // Third Stage
        {
          $sort: sort,
        },
      ])
      .toArray();
    return rows;
  }
  async updateMany(query = {}, fields = {}) {
    try {
      return await this.db
        .collection(collection)
        .updateMany(query, { $set: fields });
    } catch (e) {
      console.log(e);
    }
  }
  async updateEstoqueMany(items = []) {
    if (!Array.isArray(items)) return null;
    let query = {};
    let fields = {};
    for (let item of items) {
      query = { id: Number(item?.id) };
      fields = {
        estoque: Number(item?.estoque),
        preco: Number(item?.preco),
        preco_promocional: Number(item?.preco_promocional),
      };

      try {
        return await this.db
          .collection(collection)
          .updateMany(query, { $set: fields });
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(e);
      }
    } //for
  }
}

export { MpkAnuncio };
