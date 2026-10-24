const Designation = require("../models/designation");
const { createLookupService } = require("../services/lookup.service");
const { createLookupController } = require("../controllers/lookup.controller");
const { createLookupRouter } = require("./lookup.router");

const service = createLookupService({ Model: Designation, label: "Designation", entity: "designation" });
const controller = createLookupController(service, { plural: "designations", singular: "designation" });

module.exports = createLookupRouter(controller);
