    import { metricsService } from "../services/metrics.service.js";

    export const metricsController = {
    async overview(req, res, next) {
        try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : 1;
        const data = await metricsService.overview({ warehouseId });

        const salesTodayNet = data.salesToday.paid - data.salesToday.refunded;
        const salesMonthNet = data.salesMonth.paid - data.salesMonth.refunded;

        const openDue = data.openReceivable.openTotal - (data.openReceivable.paid - data.openReceivable.refunded);
        const profitMonthEstimate = salesMonthNet - data.expensesMonth.total;

        res.json({
            ok: true,
            data: {
            ...data,
            derived: { salesTodayNet, salesMonthNet, openDue, profitMonthEstimate },
            updatedAt: new Date().toISOString()
            }
        });
        } catch (e) {
        next(e);
        }
    },

    // ✅ NUEVO
    async trends(req, res, next) {
        try {
        const days = req.query.days ? Number(req.query.days) : 30;
        const data = await metricsService.trends({ days });
        res.json({ ok: true, data: { ...data, updatedAt: new Date().toISOString() } });
        } catch (e) {
        next(e);
        }
    }
    };