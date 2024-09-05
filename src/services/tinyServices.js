import { tinyApi } from "../api/tinyApi.js";

class Tiny {
  token;
  constructor({ token }) {
    this.token = token;
  }
  async get(url) {
    return await tinyApi(url, [], "GET");
  }
  async post(url, data = []) {
    data.push({ key: "token", value: this.token });
    return await tinyApi(url, data, "POST");
  }
  async put(url, data = []) {
    data.push({ key: "token", value: this.token });
    return await tinyApi(url, data, "PUT");
  }
  async delete(url) {
    return await tinyApi(`${url}?token=${this.token}`, [], "DELETE");
  }
  async patch(url, data = []) {
    return await tinyApi(`${url}?token=${this.token}`, data, "PATCH");
  }
}

export { Tiny };

/*
# inspiracao 
https://publicapis.io/woocommerce-api

const tiny = new Tiny();
 tiny.put(url, data);
 tiny.post(url, data);
 tiny.get(url);
 tiny.delete(url);
 tiny.patch(url, data);
 
*/
