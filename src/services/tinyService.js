import { tinyApi } from "../api/tinyApi.js";

//fiz aqui pra nao ter a dependencia da lib
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Tiny {
  timeout = 0
  constructor({ token }) {
    this.token = token;

  }
  async get(url) {
    data.push({ key: "token", value: this.token });
    return await tinyApi(url, [], "GET");
  }
  async post(url, data = []) {
    console.log(url);
    data.push({ key: "token", value: this.token });
    data.push({ key: "formato", value: "json" });
    return await tinyApi(url, data, "POST");
  }
  async put(url, data = []) {
    data.push({ key: "token", value: this.token });
    data.push({ key: "formato", value: "json" });

    return await tinyApi(url, data, "PUT");
  }
  async delete(url) {
    return await tinyApi(`${url}?token=${this.token}`, [], "DELETE");
  }
  async patch(url, data = []) {
    return await tinyApi(`${url}?token=${this.token}`, data, "PATCH");
  }

  async tratarRetorno(response, prop) {

    if (response.status == 429) {
      console.log("Requisição bloqueada, aguardando 10 segundos...");
      await sleep(this.timeout);
      return response?.data;
    }

    let result = null;
    let retorno = response?.data?.retorno;
    if (retorno?.status == "OK") {
      return retorno[prop];
    }

    if (retorno?.status == "Erro") {
      console.log(response?.data?.retorno[prop]);
      await sleep(this.timeout);
      return response?.data;
    }
    console.log(response);
    //tratar o cabecalho
  }


  async setTimeout(timeout) {
    this.timeout = timeout;
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
