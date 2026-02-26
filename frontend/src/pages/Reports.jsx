    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import "./reports.css";

    import {
    FileDown,
    RefreshCw,
    Warehouse,
    CalendarRange,
    ShoppingCart,
    Receipt,
    Boxes,
    BarChart3,
    BadgeDollarSign,
    HandCoins,
    AlertTriangle,
    } from "lucide-react";

    function isoToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
    }

    function filenameFromDisposition(cd) {
    if (!cd) return null;
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
    const raw = m?.[1] || m?.[2];
    return raw ? decodeURIComponent(raw) : null;
    }

    async function downloadWithAuth(path, fallbackName = "reporte") {
    const res = await api.get(path, {
        responseType: "blob",
        validateStatus: (s) => s >= 200 && s < 500,
    });

    const ct = res.headers?.["content-type"] || "";
    if (res.status >= 400) {
        if (ct.includes("application/json")) {
        const txt = await res.data.text();
        const json = JSON.parse(txt);
        throw new Error(json?.message || "Error descargando archivo");
        }
        throw new Error("Error descargando archivo");
    }

    const cd = res.headers?.["content-disposition"];
    const filename = filenameFromDisposition(cd) || fallbackName;

    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    }

    const SECTIONS = [
    { key: "sales", label: "Ventas", icon: ShoppingCart },
    { key: "expenses", label: "Gastos", icon: Receipt },
    { key: "inventory", label: "Inventario", icon: Boxes },
    { key: "kardex", label: "Kardex", icon: BarChart3 },
    { key: "payroll", label: "Nómina", icon: BadgeDollarSign },
    { key: "debts", label: "Deudas", icon: HandCoins },
    ];

    export default function Reports() {
    const [active, setActive] = useState("sales");

    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    // datos para selects
    const [products, setProducts] = useState([]);
    const [employees, setEmployees] = useState([]);

    // filtros globales
    const [warehouseId, setWarehouseId] = useState(1);
    const [range, setRange] = useState({
        from: "2026-02-01",
        to: "2026-02-28",
    });

    // filtros por sección
    const [expensesCategoryId, setExpensesCategoryId] = useState("");
    const [kardexProductId, setKardexProductId] = useState("");

    const [saleId, setSaleId] = useState("");
    const [payrollRunId, setPayrollRunId] = useState("");

    const [debtStatus, setDebtStatus] = useState("OPEN");
    const [debtEmployeeId, setDebtEmployeeId] = useState("");

    const [downloading, setDownloading] = useState(false);

    const clearAlerts = () => {
        setMsg("");
        setError("");
    };

    useEffect(() => {
        Promise.all([api.get("/products?all=1"), api.get("/employees?all=1")])
        .then(([p, e]) => {
            setProducts(p.data.data || []);
            setEmployees(e.data.data || []);
        })
        .catch(() => {});
    }, []);

    const resetDatesToday = () => {
        clearAlerts();
        const t = isoToday();
        setRange({ from: t, to: t });
        setMsg("Rango ajustado a HOY ✅");
    };

    const runDownload = async (path, name) => {
        clearAlerts();
        try {
        setDownloading(true);
        await downloadWithAuth(path, name);
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        } finally {
        setDownloading(false);
        }
    };

    // ===== Acciones =====
    const salesExcel = () =>
        runDownload(
        `/reports/sales.xlsx?from=${range.from}&to=${range.to}`,
        `ventas_${range.from}_a_${range.to}.xlsx`
        );

    const salePdf = () => {
        if (!saleId) return setError("Pon el ID de la venta");
        runDownload(`/reports/sales/${saleId}/pdf`, `venta-${saleId}.pdf`);
    };

    const expensesExcel = () => {
        const q = `from=${range.from}&to=${range.to}${expensesCategoryId ? `&categoryId=${expensesCategoryId}` : ""}`;
        runDownload(`/reports/expenses.xlsx?${q}`, `gastos_${range.from}_a_${range.to}.xlsx`);
    };

    const expensesPdf = () => {
        const q = `from=${range.from}&to=${range.to}${expensesCategoryId ? `&categoryId=${expensesCategoryId}` : ""}`;
        runDownload(`/reports/expenses.pdf?${q}`, `gastos_${range.from}_a_${range.to}.pdf`);
    };

    const inventoryExcel = () =>
        runDownload(`/reports/inventory.xlsx?warehouseId=${warehouseId}`, `inventario_bodega-${warehouseId}.xlsx`);

    const inventoryPdf = () =>
        runDownload(`/reports/inventory.pdf?warehouseId=${warehouseId}`, `inventario_bodega-${warehouseId}.pdf`);

    const kardexExcel = () => {
        if (!kardexProductId) return setError("Selecciona un producto para kardex");
        const q = `warehouseId=${warehouseId}&productId=${kardexProductId}&from=${range.from}&to=${range.to}`;
        runDownload(`/reports/kardex.xlsx?${q}`, `kardex_wh-${warehouseId}_prod-${kardexProductId}.xlsx`);
    };

    const kardexPdf = () => {
        if (!kardexProductId) return setError("Selecciona un producto para kardex");
        const q = `warehouseId=${warehouseId}&productId=${kardexProductId}&from=${range.from}&to=${range.to}`;
        runDownload(`/reports/kardex.pdf?${q}`, `kardex_wh-${warehouseId}_prod-${kardexProductId}.pdf`);
    };

    const payrollExcel = () => {
        if (!payrollRunId) return setError("Pon el ID del payroll run");
        runDownload(`/reports/payroll/${payrollRunId}.xlsx`, `nomina_${payrollRunId}.xlsx`);
    };

    const payrollPdf = () => {
        if (!payrollRunId) return setError("Pon el ID del payroll run");
        runDownload(`/reports/payroll/${payrollRunId}/pdf`, `nomina_${payrollRunId}.pdf`);
    };

    const debtsExcel = () => {
        const q = `status=${debtStatus}` + (debtEmployeeId ? `&employeeId=${debtEmployeeId}` : "");
        runDownload(`/reports/debts.xlsx?${q}`, `deudas_${debtStatus}.xlsx`);
    };

    const debtsPdf = () => {
        const q = `status=${debtStatus}` + (debtEmployeeId ? `&employeeId=${debtEmployeeId}` : "");
        runDownload(`/reports/debts.pdf?${q}`, `deudas_${debtStatus}.pdf`);
    };

    const activeProducts = useMemo(() => products.filter((p) => p.is_active === 1), [products]);
    const activeEmployees = useMemo(() => employees.filter((e) => e.is_active === 1), [employees]);

    return (
        <div className="rep-page">
        <div className="rep-head">
            <div>
            <div className="rep-title">Reportes</div>
            <div className="rep-subtitle">Descarga Excel/PDF de todos los módulos con filtros.</div>
            </div>

            <div className="rep-actions">
            <button className="r-btn r-btn-ghost" type="button" onClick={resetDatesToday}>
                <RefreshCw size={16} /> Hoy
            </button>
            </div>
        </div>

        {(error || msg) && (
            <div className={`r-alert ${error ? "r-alert--error" : "r-alert--ok"}`}>
            <div className="r-alert__text">
                {error ? <AlertTriangle size={16} /> : null}
                {error || msg}
            </div>
            <button className="r-alert__close" onClick={clearAlerts}>
                ✕
            </button>
            </div>
        )}

        {/* Filtros globales */}
        <div className="r-card">
            <div className="r-card__head">
            <div className="r-card__title">
                <CalendarRange size={18} /> Filtros globales
            </div>
            <div className="r-chip">Se aplican donde corresponda</div>
            </div>

            <div className="r-grid">
            <div className="r-field">
                <label>Desde</label>
                <input
                className="r-input"
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                />
            </div>

            <div className="r-field">
                <label>Hasta</label>
                <input
                className="r-input"
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                />
            </div>

            <div className="r-field">
                <label>Bodega ID</label>
                <div className="r-inline">
                <Warehouse size={16} />
                <input
                    className="r-input r-input-tight"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    style={{ width: 120 }}
                />
                </div>
            </div>

            <div className="r-field">
                <label>Estado descarga</label>
                <div className="r-chip">{downloading ? "Descargando..." : "Listo"}</div>
            </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="r-tabs">
            {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
                <button
                key={s.key}
                className={`r-tab ${active === s.key ? "r-tab--active" : ""}`}
                onClick={() => setActive(s.key)}
                type="button"
                >
                <Icon size={16} /> {s.label}
                </button>
            );
            })}
        </div>

        {/* Panel */}
        <div className="r-card">
            {/* Ventas */}
            {active === "sales" && (
            <>
                <div className="r-card__head">
                <div className="r-card__title">
                    <ShoppingCart size={18} /> Ventas
                </div>
                <div className="r-chip">Rango: {range.from} → {range.to}</div>
                </div>

                <div className="r-actions-row">
                <button className="r-btn" onClick={salesExcel} type="button" disabled={downloading}>
                    <FileDown size={16} /> Excel (rango)
                </button>

                <div className="r-field">
                    <label>Venta ID (PDF)</label>
                    <input className="r-input" value={saleId} onChange={(e) => setSaleId(e.target.value)} placeholder="Ej: 12" />
                </div>

                <button className="r-btn r-btn-ghost" onClick={salePdf} type="button" disabled={downloading}>
                    <FileDown size={16} /> PDF (venta)
                </button>
                </div>
            </>
            )}

            {/* Gastos */}
            {active === "expenses" && (
            <>
                <div className="r-card__head">
                <div className="r-card__title">
                    <Receipt size={18} /> Gastos
                </div>
                <div className="r-chip">Rango: {range.from} → {range.to}</div>
                </div>

                <div className="r-actions-row">
                <div className="r-field">
                    <label>Categoría ID (opcional)</label>
                    <input
                    className="r-input"
                    value={expensesCategoryId}
                    onChange={(e) => setExpensesCategoryId(e.target.value)}
                    placeholder="Ej: 1"
                    style={{ width: 180 }}
                    />
                </div>

                <button className="r-btn" onClick={expensesExcel} type="button" disabled={downloading}>
                    <FileDown size={16} /> Excel
                </button>

                <button className="r-btn r-btn-ghost" onClick={expensesPdf} type="button" disabled={downloading}>
                    <FileDown size={16} /> PDF
                </button>
                </div>
            </>
            )}

            {/* Inventario */}
            {active === "inventory" && (
            <>
                <div className="r-card__head">
                <div className="r-card__title">
                    <Boxes size={18} /> Inventario
                </div>
                <div className="r-chip">Bodega #{warehouseId}</div>
                </div>

                <div className="r-actions-row">
                <button className="r-btn" onClick={inventoryExcel} type="button" disabled={downloading}>
                    <FileDown size={16} /> Excel (bodega)
                </button>
                <button className="r-btn r-btn-ghost" onClick={inventoryPdf} type="button" disabled={downloading}>
                    <FileDown size={16} /> PDF (bodega)
                </button>
                </div>
            </>
            )}

            {/* Kardex */}
            {active === "kardex" && (
            <>
                <div className="r-card__head">
                <div className="r-card__title">
                    <BarChart3 size={18} /> Kardex
                </div>
                <div className="r-chip">
                    WH #{warehouseId} · {range.from} → {range.to}
                </div>
                </div>

                <div className="r-actions-row">
                <div className="r-field r-wide">
                    <label>Producto</label>
                    <select className="r-input" value={kardexProductId} onChange={(e) => setKardexProductId(e.target.value)}>
                    <option value="">-- Selecciona --</option>
                    {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                        #{p.id} - {p.name} {p.gramaje} ({p.unit})
                        </option>
                    ))}
                    </select>
                </div>

                <button className="r-btn" onClick={kardexExcel} type="button" disabled={downloading}>
                    <FileDown size={16} /> Excel
                </button>
                <button className="r-btn r-btn-ghost" onClick={kardexPdf} type="button" disabled={downloading}>
                    <FileDown size={16} /> PDF
                </button>
                </div>
            </>
            )}

            {/* Nómina */}
            {active === "payroll" && (
            <>
                <div className="r-card__head">
                <div className="r-card__title">
                    <BadgeDollarSign size={18} /> Nómina
                </div>
                <div className="r-chip">Por Payroll Run ID</div>
                </div>

                <div className="r-actions-row">
                <div className="r-field">
                    <label>Payroll Run ID</label>
                    <input
                    className="r-input"
                    value={payrollRunId}
                    onChange={(e) => setPayrollRunId(e.target.value)}
                    placeholder="Ej: 3"
                    style={{ width: 220 }}
                    />
                </div>

                <button className="r-btn" onClick={payrollExcel} type="button" disabled={downloading}>
                    <FileDown size={16} /> Excel
                </button>
                <button className="r-btn r-btn-ghost" onClick={payrollPdf} type="button" disabled={downloading}>
                    <FileDown size={16} /> PDF
                </button>
                </div>
            </>
            )}

            {/* Deudas */}
            {active === "debts" && (
            <>
                <div className="r-card__head">
                <div className="r-card__title">
                    <HandCoins size={18} /> Deudas
                </div>
                <div className="r-chip">Filtra por estado/empleado</div>
                </div>

                <div className="r-actions-row">
                <div className="r-field">
                    <label>Estado</label>
                    <select className="r-input" value={debtStatus} onChange={(e) => setDebtStatus(e.target.value)}>
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSED">CLOSED</option>
                    </select>
                </div>

                <div className="r-field r-wide">
                    <label>Empleado (opcional)</label>
                    <select className="r-input" value={debtEmployeeId} onChange={(e) => setDebtEmployeeId(e.target.value)}>
                    <option value="">(Todos)</option>
                    {activeEmployees.map((e) => (
                        <option key={e.id} value={e.id}>
                        #{e.id} {e.full_name}
                        </option>
                    ))}
                    </select>
                </div>

                <button className="r-btn" onClick={debtsExcel} type="button" disabled={downloading}>
                    <FileDown size={16} /> Excel
                </button>
                <button className="r-btn r-btn-ghost" onClick={debtsPdf} type="button" disabled={downloading}>
                    <FileDown size={16} /> PDF
                </button>
                </div>
            </>
            )}
        </div>
        </div>
    );
    }