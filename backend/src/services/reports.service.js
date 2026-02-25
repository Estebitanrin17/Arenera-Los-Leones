    import ExcelJS from "exceljs";
    import PDFDocument from "pdfkit";
    import { reportsRepo } from "../repositories/reports.repo.js";
    import { salesRepo } from "../repositories/sales.repo.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const reportsService = {
    // =========================
    // VENTAS: Excel
    // =========================
    async buildSalesExcel({ from, to, status }) {
        const fromDT = `${from} 00:00:00`;
        const toDT = `${to} 23:59:59`;

        const summary = await reportsRepo.salesSummary({ from: fromDT, to: toDT, status });
        const items = await reportsRepo.salesItems({ from: fromDT, to: toDT, status });

        const wb = new ExcelJS.Workbook();
        wb.creator = "Arena System";

        const wsSales = wb.addWorksheet("Ventas");
        wsSales.columns = [
        { header: "Sale ID", key: "id", width: 10 },
        { header: "Fecha", key: "created_at", width: 22 },
        { header: "Estado", key: "status", width: 12 },
        { header: "Cliente", key: "customer_name", width: 22 },
        { header: "Teléfono", key: "customer_phone", width: 16 },
        { header: "Subtotal", key: "subtotal", width: 12 },
        { header: "Descuento", key: "discount", width: 12 },
        { header: "Total", key: "total", width: 12 },
        { header: "Pagado", key: "paid", width: 12 },
        { header: "Reembolsado", key: "refunded", width: 14 },
        { header: "Neto Pagado", key: "net_paid", width: 12 }
        ];
        wsSales.getRow(1).font = { bold: true };

        for (const s of summary) {
        const paid = Number(s.paid ?? 0);
        const refunded = Number(s.refunded ?? 0);
        wsSales.addRow({
            id: s.id,
            created_at: s.created_at,
            status: s.status,
            customer_name: s.customer_name ?? "",
            customer_phone: s.customer_phone ?? "",
            subtotal: Number(s.subtotal),
            discount: Number(s.discount),
            total: Number(s.total),
            paid,
            refunded,
            net_paid: paid - refunded
        });
        }

        const wsItems = wb.addWorksheet("Items");
        wsItems.columns = [
        { header: "Sale ID", key: "sale_id", width: 10 },
        { header: "Fecha", key: "created_at", width: 22 },
        { header: "Estado", key: "status", width: 12 },
        { header: "Producto", key: "product_name", width: 20 },
        { header: "Gramaje", key: "gramaje", width: 10 },
        { header: "Unidad", key: "unit", width: 10 },
        { header: "Precio Unit", key: "unit_price", width: 12 },
        { header: "Cantidad", key: "quantity", width: 10 },
        { header: "Total Línea", key: "line_total", width: 12 }
        ];
        wsItems.getRow(1).font = { bold: true };

        for (const it of items) {
        wsItems.addRow({
            sale_id: it.sale_id,
            created_at: it.created_at,
            status: it.status,
            product_name: it.product_name,
            gramaje: it.gramaje,
            unit: it.unit,
            unit_price: Number(it.unit_price),
            quantity: it.quantity,
            line_total: Number(it.line_total)
        });
        }

        return await wb.xlsx.writeBuffer();
    },

    // =========================
    // VENTAS: PDF
    // =========================
    async streamSalePdf({ saleId, res }) {
        const sale = await salesRepo.getById(saleId);
        if (!sale) throw httpError(404, "Venta no encontrada");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="venta-${saleId}.pdf"`);

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("RECIBO DE VENTA", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Venta #${sale.id}`);
        doc.text(`Fecha: ${new Date(sale.created_at).toLocaleString()}`);
        doc.text(`Estado: ${sale.status}`);
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Cliente: ${sale.customer_name ?? "N/A"}`);
        if (sale.customer_phone) doc.text(`Teléfono: ${sale.customer_phone}`);
        if (sale.note) doc.text(`Nota: ${sale.note}`);
        doc.moveDown(1);

        doc.fontSize(12).text("Detalle", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        doc.text("Producto", 40, doc.y, { continued: true });
        doc.text("Cant", 260, doc.y, { continued: true, width: 60, align: "right" });
        doc.text("P.Unit", 330, doc.y, { continued: true, width: 80, align: "right" });
        doc.text("Total", 420, doc.y, { width: 100, align: "right" });
        doc.moveDown(0.3);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.3);

        for (const it of sale.items) {
        const name = `${it.product_name} ${it.gramaje}`;
        doc.text(name, 40, doc.y, { continued: true, width: 210 });
        doc.text(String(it.quantity), 260, doc.y, { continued: true, width: 60, align: "right" });
        doc.text(Number(it.unit_price).toFixed(2), 330, doc.y, { continued: true, width: 80, align: "right" });
        doc.text(Number(it.line_total).toFixed(2), 420, doc.y, { width: 100, align: "right" });
        }

        doc.moveDown(1);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.5);

        const paid = (sale.payments || []).reduce((a, p) => a + Number(p.amount), 0);
        const refunded = (sale.refunds || []).reduce((a, r) => a + Number(r.amount), 0);
        const netPaid = paid - refunded;

        doc.fontSize(11);
        doc.text(`Subtotal: ${Number(sale.subtotal).toFixed(2)}`, { align: "right" });
        doc.text(`Descuento: ${Number(sale.discount).toFixed(2)}`, { align: "right" });
        doc.text(`Total: ${Number(sale.total).toFixed(2)}`, { align: "right" });
        doc.moveDown(0.5);
        doc.text(`Pagado: ${paid.toFixed(2)}`, { align: "right" });
        doc.text(`Reembolsado: ${refunded.toFixed(2)}`, { align: "right" });
        doc.text(`Neto pagado: ${netPaid.toFixed(2)}`, { align: "right" });

        doc.moveDown(1.2);
        doc.fontSize(10).text("Gracias por su compra.", { align: "center" });

        doc.end();
    },

    // =========================
    // GASTOS: Excel
    // =========================
    async buildExpensesExcel({ from, to, categoryId, includeInactive }) {
        const rows = await reportsRepo.expensesRows({ from, to, categoryId, includeInactive });
        const summary = await reportsRepo.expensesSummaryByCategory({ from, to, includeInactive });

        const wb = new ExcelJS.Workbook();
        wb.creator = "Arena System";

        const ws = wb.addWorksheet("Gastos");
        ws.columns = [
        { header: "ID", key: "id", width: 8 },
        { header: "Fecha", key: "expense_date", width: 12 },
        { header: "Categoría", key: "category_name", width: 18 },
        { header: "Título", key: "title", width: 26 },
        { header: "Proveedor", key: "vendor", width: 18 },
        { header: "Método", key: "payment_method", width: 12 },
        { header: "Monto", key: "amount", width: 12 },
        { header: "Nota", key: "note", width: 30 },
        { header: "Activo", key: "is_active", width: 8 }
        ];
        ws.getRow(1).font = { bold: true };

        for (const r of rows) {
        ws.addRow({
            id: r.id,
            expense_date: r.expense_date,
            category_name: r.category_name ?? "Sin categoría",
            title: r.title,
            vendor: r.vendor ?? "",
            payment_method: r.payment_method,
            amount: Number(r.amount),
            note: r.note ?? "",
            is_active: r.is_active ? "Sí" : "No"
        });
        }

        const wsSum = wb.addWorksheet("Resumen");
        wsSum.columns = [
        { header: "Categoría", key: "category_name", width: 24 },
        { header: "Cantidad", key: "count_expenses", width: 12 },
        { header: "Total", key: "total_amount", width: 14 }
        ];
        wsSum.getRow(1).font = { bold: true };

        for (const s of summary) {
        wsSum.addRow({
            category_name: s.category_name,
            count_expenses: Number(s.count_expenses),
            total_amount: Number(s.total_amount)
        });
        }

        return await wb.xlsx.writeBuffer();
    },

    // =========================
    // GASTOS: PDF
    // =========================
    async streamExpensesPdf({ from, to, categoryId, includeInactive, res }) {
        const rows = await reportsRepo.expensesRows({ from, to, categoryId, includeInactive });
        const summary = await reportsRepo.expensesSummaryByCategory({ from, to, includeInactive });
        const total = rows.reduce((acc, r) => acc + Number(r.amount), 0);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="gastos_${from}_a_${to}.pdf"`);

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("REPORTE DE GASTOS", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Rango: ${from} a ${to}`);
        if (categoryId) doc.text(`Filtro categoría ID: ${categoryId}`);
        doc.text(`Incluye inactivos: ${includeInactive ? "Sí" : "No"}`);
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Total gastos: ${total.toFixed(2)}`);
        doc.moveDown(1);

        doc.fontSize(12).text("Resumen por categoría", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        for (const s of summary) {
        doc.text(`${s.category_name}: ${Number(s.total_amount).toFixed(2)}  (${s.count_expenses} registros)`);
        }

        doc.moveDown(1);
        doc.fontSize(12).text("Detalle", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        doc.text("Fecha", 40, doc.y, { continued: true, width: 80 });
        doc.text("Categoría", 120, doc.y, { continued: true, width: 120 });
        doc.text("Título", 240, doc.y, { continued: true, width: 200 });
        doc.text("Monto", 440, doc.y, { width: 100, align: "right" });
        doc.moveDown(0.3);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.3);

        for (const r of rows) {
        const cat = r.category_name ?? "Sin categoría";
        doc.text(String(r.expense_date), 40, doc.y, { continued: true, width: 80 });
        doc.text(cat, 120, doc.y, { continued: true, width: 120 });
        doc.text(r.title, 240, doc.y, { continued: true, width: 200 });
        doc.text(Number(r.amount).toFixed(2), 440, doc.y, { width: 100, align: "right" });

        if (doc.y > 740) doc.addPage();
        }

        doc.end();
    },

    // =========================
    // INVENTARIO: Excel
    // =========================
    async buildInventoryExcel({ warehouseId }) {
        const rows = await reportsRepo.inventoryStockRows({ warehouseId });
        const totals = await reportsRepo.inventoryTotals({ warehouseId });

        const wb = new ExcelJS.Workbook();
        wb.creator = "Arena System";

        const ws = wb.addWorksheet("Inventario");
        ws.columns = [
        { header: "Producto ID", key: "product_id", width: 12 },
        { header: "Producto", key: "name", width: 20 },
        { header: "Gramaje", key: "gramaje", width: 10 },
        { header: "Unidad", key: "unit", width: 10 },
        { header: "Precio", key: "price", width: 12 },
        { header: "Cantidad", key: "quantity", width: 12 }
        ];
        ws.getRow(1).font = { bold: true };

        for (const r of rows) {
        ws.addRow({
            product_id: r.product_id,
            name: r.name,
            gramaje: r.gramaje,
            unit: r.unit,
            price: Number(r.price),
            quantity: Number(r.quantity)
        });
        }

        const wsSum = wb.addWorksheet("Resumen");
        wsSum.columns = [
        { header: "Métrica", key: "metric", width: 24 },
        { header: "Valor", key: "value", width: 18 }
        ];
        wsSum.getRow(1).font = { bold: true };

        wsSum.addRow({ metric: "Bodega ID", value: warehouseId });
        wsSum.addRow({ metric: "Total productos activos", value: Number(totals.total_products) });
        wsSum.addRow({ metric: "Total unidades (bultos)", value: Number(totals.total_units) });

        return await wb.xlsx.writeBuffer();
    },

    // =========================
    // INVENTARIO: PDF
    // =========================
    async streamInventoryPdf({ warehouseId, res }) {
        const rows = await reportsRepo.inventoryStockRows({ warehouseId });
        const totals = await reportsRepo.inventoryTotals({ warehouseId });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="inventario_bodega-${warehouseId}.pdf"`);

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("REPORTE DE INVENTARIO", { align: "center" });
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Bodega ID: ${warehouseId}`);
        doc.text(`Total productos activos: ${Number(totals.total_products)}`);
        doc.text(`Total unidades (bultos): ${Number(totals.total_units)}`);
        doc.moveDown(1);

        doc.fontSize(12).text("Stock actual", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        doc.text("Producto", 40, doc.y, { continued: true, width: 220 });
        doc.text("Gramaje", 260, doc.y, { continued: true, width: 60, align: "right" });
        doc.text("Cant", 320, doc.y, { continued: true, width: 60, align: "right" });
        doc.text("Precio", 380, doc.y, { continued: true, width: 70, align: "right" });
        doc.text("Total", 450, doc.y, { width: 90, align: "right" });
        doc.moveDown(0.3);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.3);

        let grandValue = 0;

        for (const r of rows) {
        const qty = Number(r.quantity);
        const price = Number(r.price);
        const lineTotal = qty * price;
        grandValue += lineTotal;

        doc.text(r.name, 40, doc.y, { continued: true, width: 220 });
        doc.text(String(r.gramaje), 260, doc.y, { continued: true, width: 60, align: "right" });
        doc.text(String(qty), 320, doc.y, { continued: true, width: 60, align: "right" });
        doc.text(price.toFixed(2), 380, doc.y, { continued: true, width: 70, align: "right" });
        doc.text(lineTotal.toFixed(2), 450, doc.y, { width: 90, align: "right" });

        if (doc.y > 740) doc.addPage();
        }

        doc.moveDown(1);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Valor total estimado (stock * precio): ${grandValue.toFixed(2)}`, { align: "right" });

        doc.end();
    },

    // =========================
    // NÓMINA: Excel
    // =========================
    async buildPayrollExcel({ runId }) {
        const header = await reportsRepo.payrollRunHeader(runId);
        if (!header) throw httpError(404, "Nómina no encontrada");

        const items = await reportsRepo.payrollRunItems(runId);
        const deductions = await reportsRepo.payrollRunDeductions(runId);

        const totalGross = items.reduce((a, r) => a + Number(r.gross_amount), 0);
        const totalDed = items.reduce((a, r) => a + Number(r.total_deductions), 0);
        const totalNet = items.reduce((a, r) => a + Number(r.net_amount), 0);

        const wb = new ExcelJS.Workbook();
        wb.creator = "Arena System";

        const wsSum = wb.addWorksheet("Resumen");
        wsSum.columns = [
        { header: "Campo", key: "k", width: 22 },
        { header: "Valor", key: "v", width: 40 }
        ];
        wsSum.getRow(1).font = { bold: true };
        wsSum.addRow({ k: "Payroll Run ID", v: header.id });
        wsSum.addRow({ k: "Periodo desde", v: String(header.period_from) });
        wsSum.addRow({ k: "Periodo hasta", v: String(header.period_to) });
        wsSum.addRow({ k: "Nota", v: header.note ?? "" });
        wsSum.addRow({ k: "Total bruto", v: totalGross });
        wsSum.addRow({ k: "Total descuentos", v: totalDed });
        wsSum.addRow({ k: "Total neto", v: totalNet });

        const ws = wb.addWorksheet("Nomina");
        ws.columns = [
        { header: "Empleado", key: "employee_name", width: 26 },
        { header: "Bruto", key: "gross_amount", width: 12 },
        { header: "Descuentos", key: "total_deductions", width: 12 },
        { header: "Neto", key: "net_amount", width: 12 }
        ];
        ws.getRow(1).font = { bold: true };

        for (const r of items) {
        ws.addRow({
            employee_name: r.employee_name,
            gross_amount: Number(r.gross_amount),
            total_deductions: Number(r.total_deductions),
            net_amount: Number(r.net_amount)
        });
        }

        const wsD = wb.addWorksheet("Descuentos");
        wsD.columns = [
        { header: "Empleado", key: "employee_name", width: 26 },
        { header: "Debt ID", key: "debt_id", width: 10 },
        { header: "Tipo", key: "debt_type", width: 12 },
        { header: "Monto descontado", key: "amount", width: 16 },
        { header: "Saldo deuda (ahora)", key: "debt_balance_now", width: 16 },
        { header: "Estado deuda (ahora)", key: "debt_status_now", width: 16 }
        ];
        wsD.getRow(1).font = { bold: true };

        for (const d of deductions) {
        wsD.addRow({
            employee_name: d.employee_name,
            debt_id: d.debt_id,
            debt_type: d.debt_type,
            amount: Number(d.amount),
            debt_balance_now: Number(d.debt_balance_now),
            debt_status_now: d.debt_status_now
        });
        }

        return await wb.xlsx.writeBuffer();
    },

    // =========================
    // NÓMINA: PDF
    // =========================
    async streamPayrollPdf({ runId, res }) {
        const header = await reportsRepo.payrollRunHeader(runId);
        if (!header) throw httpError(404, "Nómina no encontrada");

        const items = await reportsRepo.payrollRunItems(runId);
        const deductions = await reportsRepo.payrollRunDeductions(runId);

        const totalGross = items.reduce((a, r) => a + Number(r.gross_amount), 0);
        const totalDed = items.reduce((a, r) => a + Number(r.total_deductions), 0);
        const totalNet = items.reduce((a, r) => a + Number(r.net_amount), 0);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="nomina-${runId}.pdf"`);

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("REPORTE DE NÓMINA", { align: "center" });
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Payroll Run #${header.id}`);
        doc.text(`Periodo: ${String(header.period_from)} a ${String(header.period_to)}`);
        if (header.note) doc.text(`Nota: ${header.note}`);
        doc.moveDown(0.5);

        doc.text(`Total bruto: ${totalGross.toFixed(2)}`);
        doc.text(`Total descuentos: ${totalDed.toFixed(2)}`);
        doc.text(`Total neto: ${totalNet.toFixed(2)}`);
        doc.moveDown(1);

        doc.fontSize(12).text("Resumen por empleado", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        doc.text("Empleado", 40, doc.y, { continued: true, width: 240 });
        doc.text("Bruto", 280, doc.y, { continued: true, width: 80, align: "right" });
        doc.text("Desc", 360, doc.y, { continued: true, width: 80, align: "right" });
        doc.text("Neto", 440, doc.y, { width: 100, align: "right" });
        doc.moveDown(0.3);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.3);

        for (const r of items) {
        doc.text(r.employee_name, 40, doc.y, { continued: true, width: 240 });
        doc.text(Number(r.gross_amount).toFixed(2), 280, doc.y, { continued: true, width: 80, align: "right" });
        doc.text(Number(r.total_deductions).toFixed(2), 360, doc.y, { continued: true, width: 80, align: "right" });
        doc.text(Number(r.net_amount).toFixed(2), 440, doc.y, { width: 100, align: "right" });
        if (doc.y > 740) doc.addPage();
        }

        doc.moveDown(1);
        doc.fontSize(12).text("Descuentos aplicados", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        for (const d of deductions) {
        doc.text(
            `${d.employee_name} -> Deuda #${d.debt_id} (${d.debt_type}) : -${Number(d.amount).toFixed(2)} | saldo ahora: ${Number(d.debt_balance_now).toFixed(2)}`
        );
        if (doc.y > 740) doc.addPage();
        }

        doc.end();
    },

    // =========================
    // DEUDAS: Excel
    // =========================
    async buildDebtsExcel({ status, employeeId }) {
        const rows = await reportsRepo.debtsBalances({ status, employeeId });

        const totalBalance = rows.reduce((a, r) => a + Number(r.balance), 0);
        const totalOriginal = rows.reduce((a, r) => a + Number(r.original_amount), 0);

        const wb = new ExcelJS.Workbook();
        wb.creator = "Arena System";

        const ws = wb.addWorksheet("Deudas");
        ws.columns = [
        { header: "Debt ID", key: "id", width: 10 },
        { header: "Empleado", key: "employee_name", width: 26 },
        { header: "Tipo", key: "type", width: 12 },
        { header: "Monto inicial", key: "original_amount", width: 14 },
        { header: "Saldo", key: "balance", width: 12 },
        { header: "Estado", key: "status", width: 12 },
        { header: "Nota", key: "note", width: 30 },
        { header: "Creada", key: "created_at", width: 22 }
        ];
        ws.getRow(1).font = { bold: true };

        for (const r of rows) {
        ws.addRow({
            id: r.id,
            employee_name: r.employee_name,
            type: r.type,
            original_amount: Number(r.original_amount),
            balance: Number(r.balance),
            status: r.status,
            note: r.note ?? "",
            created_at: r.created_at
        });
        }

        const wsSum = wb.addWorksheet("Resumen");
        wsSum.columns = [
        { header: "Métrica", key: "k", width: 22 },
        { header: "Valor", key: "v", width: 18 }
        ];
        wsSum.getRow(1).font = { bold: true };
        wsSum.addRow({ k: "Total deudas", v: rows.length });
        wsSum.addRow({ k: "Total monto inicial", v: totalOriginal });
        wsSum.addRow({ k: "Total saldo", v: totalBalance });

        return await wb.xlsx.writeBuffer();
    },

    // =========================
    // DEUDAS: PDF
    // =========================
    async streamDebtsPdf({ status, employeeId, res }) {
        const rows = await reportsRepo.debtsBalances({ status, employeeId });

        const totalBalance = rows.reduce((a, r) => a + Number(r.balance), 0);
        const totalOriginal = rows.reduce((a, r) => a + Number(r.original_amount), 0);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="deudas.pdf"`);

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("REPORTE DE DEUDAS", { align: "center" });
        doc.moveDown(0.5);

        if (status) doc.fontSize(11).text(`Filtro status: ${status}`);
        if (employeeId) doc.fontSize(11).text(`Filtro empleadoId: ${employeeId}`);
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Total monto inicial: ${totalOriginal.toFixed(2)}`);
        doc.text(`Total saldo: ${totalBalance.toFixed(2)}`);
        doc.moveDown(1);

        doc.fontSize(10);
        doc.text("Empleado", 40, doc.y, { continued: true, width: 220 });
        doc.text("Tipo", 260, doc.y, { continued: true, width: 60 });
        doc.text("Saldo", 320, doc.y, { continued: true, width: 80, align: "right" });
        doc.text("Estado", 400, doc.y, { width: 120 });
        doc.moveDown(0.3);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.3);

        for (const r of rows) {
        doc.text(r.employee_name, 40, doc.y, { continued: true, width: 220 });
        doc.text(r.type, 260, doc.y, { continued: true, width: 60 });
        doc.text(Number(r.balance).toFixed(2), 320, doc.y, { continued: true, width: 80, align: "right" });
        doc.text(r.status, 400, doc.y, { width: 120 });

        if (doc.y > 740) doc.addPage();
        }

        doc.end();
    },

    // =========================
    // KARDEX: Excel
    // =========================
    async buildKardexExcel({ warehouseId, productId, from, to }) {
        const fromDT = `${from} 00:00:00`;
        const toDT = `${to} 23:59:59`;

        const all = await reportsRepo.kardexMovementsUpTo({ warehouseId, productId, toDT });

        const wb = new ExcelJS.Workbook();
        wb.creator = "Arena System";

        const wsSum = wb.addWorksheet("Resumen");
        wsSum.columns = [
        { header: "Campo", key: "k", width: 22 },
        { header: "Valor", key: "v", width: 40 }
        ];
        wsSum.getRow(1).font = { bold: true };

        const ws = wb.addWorksheet("Kardex");
        ws.columns = [
        { header: "Fecha", key: "created_at", width: 22 },
        { header: "Tipo", key: "type", width: 10 },
        { header: "Cantidad", key: "quantity", width: 10 },
        { header: "Nota", key: "note", width: 40 },
        { header: "Creado por", key: "created_by", width: 12 },
        { header: "Saldo", key: "balance", width: 10 }
        ];
        ws.getRow(1).font = { bold: true };

        wsSum.addRow({ k: "Bodega ID", v: warehouseId });
        wsSum.addRow({ k: "Producto ID", v: productId });
        wsSum.addRow({ k: "Rango", v: `${from} a ${to}` });

        if (!all.length) {
        wsSum.addRow({ k: "Nota", v: "Sin movimientos hasta la fecha final indicada" });
        ws.addRow({
            created_at: `${from} 00:00:00`,
            type: "OPEN",
            quantity: "",
            note: "Saldo de apertura (sin datos)",
            created_by: "",
            balance: 0
        });
        return await wb.xlsx.writeBuffer();
        }

        const product = {
        id: all[0].product_id,
        name: all[0].name,
        gramaje: all[0].gramaje,
        unit: all[0].unit
        };
        wsSum.addRow({ k: "Producto", v: `${product.name} ${product.gramaje} (${product.unit})` });

        let balance = 0;
        let openingBalance = 0;
        let totalIn = 0;
        let totalOut = 0;
        let totalAdjust = 0;

        const rowsWithBalance = [];

        for (const m of all) {
        if (m.type === "IN") balance += Number(m.quantity);
        else if (m.type === "OUT") balance -= Number(m.quantity);
        else if (m.type === "ADJUST") balance = Number(m.quantity);

        const ts = new Date(m.created_at).getTime();
        const inWindow = ts >= new Date(fromDT).getTime() && ts <= new Date(toDT).getTime();

        if (!inWindow) {
            openingBalance = balance;
            continue;
        }

        if (m.type === "IN") totalIn += Number(m.quantity);
        if (m.type === "OUT") totalOut += Number(m.quantity);
        if (m.type === "ADJUST") totalAdjust += 1;

        rowsWithBalance.push({
            created_at: m.created_at,
            type: m.type,
            quantity: Number(m.quantity),
            note: m.note ?? "",
            created_by: m.created_by ?? "",
            balance
        });
        }

        const closingBalance = rowsWithBalance.length
        ? rowsWithBalance[rowsWithBalance.length - 1].balance
        : openingBalance;

        wsSum.addRow({ k: "Saldo apertura", v: openingBalance });
        wsSum.addRow({ k: "Total IN", v: totalIn });
        wsSum.addRow({ k: "Total OUT", v: totalOut });
        wsSum.addRow({ k: "Ajustes (count)", v: totalAdjust });
        wsSum.addRow({ k: "Saldo cierre", v: closingBalance });

        ws.addRow({
        created_at: `${from} 00:00:00`,
        type: "OPEN",
        quantity: "",
        note: "Saldo de apertura",
        created_by: "",
        balance: openingBalance
        });

        for (const r of rowsWithBalance) ws.addRow(r);

        return await wb.xlsx.writeBuffer();
    },

    // =========================
    // KARDEX: PDF
    // =========================
    async streamKardexPdf({ warehouseId, productId, from, to, res }) {
        const fromDT = `${from} 00:00:00`;
        const toDT = `${to} 23:59:59`;

        const all = await reportsRepo.kardexMovementsUpTo({ warehouseId, productId, toDT });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
        "Content-Disposition",
        `inline; filename="kardex_wh-${warehouseId}_prod-${productId}_${from}_a_${to}.pdf"`
        );

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(18).text("KARDEX (Movimientos)", { align: "center" });
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Bodega ID: ${warehouseId}`);
        doc.text(`Producto ID: ${productId}`);
        doc.text(`Rango: ${from} a ${to}`);
        doc.moveDown(0.5);

        if (!all.length) {
        doc.text("Sin movimientos hasta la fecha final indicada.");
        doc.end();
        return;
        }

        const product = { name: all[0].name, gramaje: all[0].gramaje, unit: all[0].unit };
        doc.text(`Producto: ${product.name} ${product.gramaje} (${product.unit})`);
        doc.moveDown(0.5);

        let balance = 0;
        let openingBalance = 0;
        let totalIn = 0;
        let totalOut = 0;
        let totalAdjust = 0;

        const rows = [];
        for (const m of all) {
        if (m.type === "IN") balance += Number(m.quantity);
        else if (m.type === "OUT") balance -= Number(m.quantity);
        else if (m.type === "ADJUST") balance = Number(m.quantity);

        const ts = new Date(m.created_at).getTime();
        const inWindow = ts >= new Date(fromDT).getTime() && ts <= new Date(toDT).getTime();

        if (!inWindow) {
            openingBalance = balance;
            continue;
        }

        if (m.type === "IN") totalIn += Number(m.quantity);
        if (m.type === "OUT") totalOut += Number(m.quantity);
        if (m.type === "ADJUST") totalAdjust += 1;

        rows.push({
            created_at: m.created_at,
            type: m.type,
            quantity: Number(m.quantity),
            note: m.note ?? "",
            balance
        });
        }

        const closingBalance = rows.length ? rows[rows.length - 1].balance : openingBalance;

        doc.text(`Saldo apertura: ${openingBalance}`);
        doc.text(`Total IN: ${totalIn} | Total OUT: ${totalOut} | Ajustes: ${totalAdjust}`);
        doc.text(`Saldo cierre: ${closingBalance}`);
        doc.moveDown(1);

        doc.fontSize(12).text("Detalle", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        doc.text("Fecha", 40, doc.y, { continued: true, width: 140 });
        doc.text("Tipo", 180, doc.y, { continued: true, width: 50 });
        doc.text("Cant", 230, doc.y, { continued: true, width: 60, align: "right" });
        doc.text("Saldo", 290, doc.y, { continued: true, width: 60, align: "right" });
        doc.text("Nota", 350, doc.y, { width: 190 });
        doc.moveDown(0.3);
        doc.text("".padEnd(90, "-"));
        doc.moveDown(0.3);

        // Apertura
        doc.text(`${from} 00:00:00`, 40, doc.y, { continued: true, width: 140 });
        doc.text("OPEN", 180, doc.y, { continued: true, width: 50 });
        doc.text("-", 230, doc.y, { continued: true, width: 60, align: "right" });
        doc.text(String(openingBalance), 290, doc.y, { continued: true, width: 60, align: "right" });
        doc.text("Saldo de apertura", 350, doc.y, { width: 190 });

        for (const r of rows) {
        if (doc.y > 740) doc.addPage();

        doc.text(String(r.created_at), 40, doc.y, { continued: true, width: 140 });
        doc.text(r.type, 180, doc.y, { continued: true, width: 50 });
        doc.text(String(r.quantity), 230, doc.y, { continued: true, width: 60, align: "right" });
        doc.text(String(r.balance), 290, doc.y, { continued: true, width: 60, align: "right" });
        doc.text(r.note, 350, doc.y, { width: 190 });
        }

        doc.end();
    }
    };