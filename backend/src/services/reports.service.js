    import ExcelJS from "exceljs";
    import PDFDocument from "pdfkit";
    import { reportsRepo } from "../repositories/reports.repo.js";
    import { salesRepo } from "../repositories/sales.repo.js"; // ya lo tenías

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    function toDateRange({ from, to }) {
    // para sales usabas datetime; para expenses usaremos DATE (YYYY-MM-DD)
    return { from, to };
    }

    export const reportsService = {
    // ====== YA TENÍAS ESTO (ventas Excel/PDF) ======
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

    // ====== NUEVO: GASTOS Excel ======
    async buildExpensesExcel({ from, to, categoryId, includeInactive }) {
        const { from: f, to: t } = toDateRange({ from, to });
        const rows = await reportsRepo.expensesRows({ from: f, to: t, categoryId, includeInactive });
        const summary = await reportsRepo.expensesSummaryByCategory({ from: f, to: t, includeInactive });

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

        // ====== NUEVO: INVENTARIO Excel ======
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

    // ====== NUEVO: INVENTARIO PDF ======
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

    // Encabezados
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

    // ====== NUEVO: GASTOS PDF (rango) ======
    async streamExpensesPdf({ from, to, categoryId, includeInactive, res }) {
        const { from: f, to: t } = toDateRange({ from, to });
        const rows = await reportsRepo.expensesRows({ from: f, to: t, categoryId, includeInactive });
        const summary = await reportsRepo.expensesSummaryByCategory({ from: f, to: t, includeInactive });

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

        // Resumen por categoría
        doc.fontSize(12).text("Resumen por categoría", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);

        for (const s of summary) {
        doc.text(`${s.category_name}: ${Number(s.total_amount).toFixed(2)}  (${s.count_expenses} registros)`);
        }

        doc.moveDown(1);
        doc.fontSize(12).text("Detalle", { underline: true });
        doc.moveDown(0.5);

        // Encabezado simple
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

        // salto de página si hace falta
        if (doc.y > 740) doc.addPage();
        }

        doc.end();
    }
    };