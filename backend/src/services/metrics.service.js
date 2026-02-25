    import { metricsRepo } from "../repositories/metrics.repo.js";

    function toYYYYMMDD(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
    }

    export const metricsService = {
    async overview({ warehouseId }) {
        const wid = Number(warehouseId || 1);
        return metricsRepo.overview({ warehouseId: wid });
    },

    async trends({ days }) {
        const n = Math.max(7, Math.min(120, Number(days || 30))); // 7..120
        const start = new Date();
        start.setDate(start.getDate() - (n - 1));
        const startDate = toYYYYMMDD(start);
        const data = await metricsRepo.trends({ startDate });
        return { days: n, startDate, ...data };
    }
    };