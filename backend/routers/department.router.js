const Department = require("../models/department");
const { createLookupService } = require("../services/lookup.service");
const { createLookupController } = require("../controllers/lookup.controller");
const { createLookupRouter } = require("./lookup.router");

const service = createLookupService({ Model: Department, label: "Department", entity: "department" });
const controller = createLookupController(service, { plural: "departments", singular: "department" });

module.exports = createLookupRouter(controller);
