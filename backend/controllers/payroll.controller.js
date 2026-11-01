const service = require("../services/payroll.service");

const listRuns = async (req, res) => {
  res.status(200).json({ success: true, runs: await service.listRuns() });
};

const createRun = async (req, res) => {
  const run = await service.createRun(req.user, req.body);
  res.status(201).json({ success: true, message: "Draft payroll created", run });
};

const getRun = async (req, res) => {
  res.status(200).json({ success: true, ...(await service.getRun(req.params.id)) });
};

const recalculate = async (req, res) => {
  const run = await service.recalculateRun(req.user, req.params.id);
  res.status(200).json({ success: true, message: "Draft recalculated", run });
};

const remove = async (req, res) => {
  await service.deleteRun(req.user, req.params.id);
  res.status(200).json({ success: true, message: "Draft deleted" });
};

const finalize = async (req, res) => {
  const run = await service.finalizeRun(req.user, req.params.id);
  res.status(200).json({ success: true, message: "Payroll finalized and locked", run });
};

const myPayslips = async (req, res) => {
  res.status(200).json({ success: true, payslips: await service.listMyPayslips(req.user) });
};

const getPayslip = async (req, res) => {
  res.status(200).json({ success: true, payslip: await service.getPayslip(req.user, req.params.id) });
};

const payslipPdf = async (req, res) => {
  const { buffer, filename } = await service.payslipPdf(req.user, req.params.id);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "Content-Length": buffer.length,
  });
  res.status(200).send(buffer);
};

module.exports = { listRuns, createRun, getRun, recalculate, remove, finalize, myPayslips, getPayslip, payslipPdf };
