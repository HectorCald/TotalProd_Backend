const express = require('express');
const CompanyTypeController = require('../controllers/CampanyTypeController');

const router = express.Router();

router.get('/getAll', CompanyTypeController.getAll);

module.exports = router;
