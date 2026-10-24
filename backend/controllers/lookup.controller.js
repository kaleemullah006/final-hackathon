// Builds the request handlers for a lookup service (departments, designations)
function createLookupController(service, { plural, singular }) {
  const list = async (req, res) => {
    const items = await service.list({ activeOnly: req.query.active === "true" });
    res.status(200).json({ success: true, [plural]: items });
  };

  const create = async (req, res) => {
    const item = await service.create(req.user, req.body);
    res.status(201).json({ success: true, message: "Created", [singular]: item });
  };

  const update = async (req, res) => {
    const item = await service.update(req.user, req.params.id, req.body);
    res.status(200).json({ success: true, message: "Saved", [singular]: item });
  };

  return { list, create, update };
}

module.exports = { createLookupController };
