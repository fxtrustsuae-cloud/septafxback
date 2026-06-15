const express = require("express");
const router = express.Router();

const dealsVlidator = require("../validator/deals.validator");
const dealsController = require("../controller/deals.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/deal/ticket", dealsVlidator.getDealByTicket, verifyJWTToken, checkAdminPermission("DEAL-BY-TICKET"), dealsController.getDealByTicket);
router.get("/deal/list", dealsVlidator.getDealsList, verifyJWTToken, checkAdminPermission("DEAL-LIST"), dealsController.getDealsList);
router.get("/deal/page", dealsVlidator.getDealsPage, verifyJWTToken, checkAdminPermission("DEAL-PAGE"), dealsController.getDealsPage);
router.get("/deal/batch", dealsVlidator.getDealBatch, verifyJWTToken, checkAdminPermission("DEAL-BATCH"), dealsController.getDealBatch);
router.put("/deal/update", dealsVlidator.updateDeal, verifyJWTToken, checkAdminPermission("DEAL-UPDATE"), dealsController.updateDeal);
router.delete("/deal/delete", dealsVlidator.deleteDeal, verifyJWTToken, checkAdminPermission("DEAL-DELETE"), dealsController.deleteDeal);

module.exports = router;