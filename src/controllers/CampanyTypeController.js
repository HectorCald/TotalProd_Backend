const CompanyType = require('../models/CompanyType');

class CompanyTypeController {
    static async getAll(req, res) {
        try {
            const companyTypes = await CompanyType.getAll();
            res.status(200).json({
                success: true,
                data: companyTypes
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener tipos de empresa'
            });
        }
    }
}

module.exports = CompanyTypeController;
