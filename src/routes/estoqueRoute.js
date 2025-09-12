import express from "express";
const router = express.Router();
import { estoqueController } from "../controller/estoqueController.js";

//Atualizar estoque ao atualizar o produto
//router.post("/", create);
router.put("/", estoqueController.update);
//router.get("/:codigo", get);

const estoqueRoutes = router;
export { estoqueRoutes };
