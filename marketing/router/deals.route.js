const express = require("express");
const router = express.Router();

const dealsVlidator = require("../validator/deals.validator");
const dealsController = require("../controller/deals.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.get("/deal/ticket", dealsVlidator.getDealByTicket, verifyJWTToken, dealsController.getDealByTicket);
router.get("/deal/list", dealsVlidator.getDealsList, verifyJWTToken, dealsController.getDealsList);
router.get("/deal/page", dealsVlidator.getDealsPage, verifyJWTToken, dealsController.getDealsPage);
router.get("/deal/batch", dealsVlidator.getDealBatch, verifyJWTToken, dealsController.getDealBatch);
router.put("/deal/update", dealsVlidator.updateDeal, verifyJWTToken, dealsController.updateDeal);
router.delete("/deal/delete", dealsVlidator.deleteDeal, verifyJWTToken, dealsController.deleteDeal);

module.exports = router;