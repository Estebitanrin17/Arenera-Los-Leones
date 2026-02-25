    import { useEffect, useState } from "react";
    import { api } from "../services/api";

    export default function Reports() {
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    // datos para selects
    const [products, setProducts] = useState([]);
    const [employees, setEmployees] = useState([]);

    // filtros
    const [warehouseId, setWarehouseId] = useState(1);

    const [range, setRange] = useState({
        from: "2026-02-01",
        to: "2026-02-28"
    });

    const [expensesCategoryId, setExpensesCategoryId] = useState(""); // opcional
    const [kardexProductId, setKardexProductId] = useState("");

    const [saleId, setSaleId] = useState("");
    const [payrollRunId, setPayrollRunId] = useState("");

    const [debtStatus, setDebtStatus] = useState("OPEN"); // OPEN/CLOSED
    const [debtEmployeeId, setDebtEmployeeId] = useState("");

    // descarga con auth
    const downloadFile = async (path, fallbackName) => {
        setError("");
        setMsg("");
        try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:3000/api${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || `Error descargando (${res.status})`);
        }

        const blob = await res.blob();
        const cd = res.headers.get("content-disposition") || "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] || fallbackName || "reporte";

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    useEffect(() => {
        // cargar productos + empleados (para selects)
        Promise.all([api.get("/products?all=1"), api.get("/employees?all=1")])
        .then(([p, e]) => {
            setProducts(p.data.data || []);
            setEmployees(e.data.data || []);
        })
        .catch(() => {});
    }, []);

    // ===== Acciones =====
    const salesExcel = () =>
        downloadFile(`/reports/sales.xlsx?from=${range.from}&to=${range.to}`, `ventas_${range.from}_a_${range.to}.xlsx`);

    const salePdf = () => {
        if (!saleId) return setError("Pon el ID de la venta");
        downloadFile(`/reports/sales/${saleId}/pdf`, `venta-${saleId}.pdf`);
    };

    const expensesExcel = () => {
        const q = `from=${range.from}&to=${range.to}${expensesCategoryId ? `&categoryId=${expensesCategoryId}` : ""}`;
        downloadFile(`/reports/expenses.xlsx?${q}`, `gastos_${range.from}_a_${range.to}.xlsx`);
    };

    const expensesPdf = () => {
        const q = `from=${range.from}&to=${range.to}${expensesCategoryId ? `&categoryId=${expensesCategoryId}` : ""}`;
        downloadFile(`/reports/expenses.pdf?${q}`, `gastos_${range.from}_a_${range.to}.pdf`);
    };

    const inventoryExcel = () =>
        downloadFile(`/reports/inventory.xlsx?warehouseId=${warehouseId}`, `inventario_bodega-${warehouseId}.xlsx`);

    const inventoryPdf = () =>
        downloadFile(`/reports/inventory.pdf?warehouseId=${warehouseId}`, `inventario_bodega-${warehouseId}.pdf`);

    const kardexExcel = () => {
        if (!kardexProductId) return setError("Selecciona un producto para kardex");
        const q = `warehouseId=${warehouseId}&productId=${kardexProductId}&from=${range.from}&to=${range.to}`;
        downloadFile(`/reports/kardex.xlsx?${q}`, `kardex_wh-${warehouseId}_prod-${kardexProductId}.xlsx`);
    };

    const kardexPdf = () => {
        if (!kardexProductId) return setError("Selecciona un producto para kardex");
        const q = `warehouseId=${warehouseId}&productId=${kardexProductId}&from=${range.from}&to=${range.to}`;
        downloadFile(`/reports/kardex.pdf?${q}`, `kardex_wh-${warehouseId}_prod-${kardexProductId}.pdf`);
    };

    const payrollExcel = () => {
        if (!payrollRunId) return setError("Pon el ID del payroll run");
        downloadFile(`/reports/payroll/${payrollRunId}.xlsx`, `nomina_${payrollRunId}.xlsx`);
    };

    const payrollPdf = () => {
        if (!payrollRunId) return setError("Pon el ID del payroll run");
        downloadFile(`/reports/payroll/${payrollRunId}/pdf`, `nomina_${payrollRunId}.pdf`);
    };

    const debtsExcel = () => {
        const q =
        `status=${debtStatus}` + (debtEmployeeId ? `&employeeId=${debtEmployeeId}` : "");
        downloadFile(`/reports/debts.xlsx?${q}`, `deudas_${debtStatus}.xlsx`);
    };

    const debtsPdf = () => {
        const q =
        `status=${debtStatus}` + (debtEmployeeId ? `&employeeId=${debtEmployeeId}` : "");
        downloadFile(`/reports/debts.pdf?${q}`, `deudas_${debtStatus}.pdf`);
    };

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Reportes</h2>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        {/* filtros generales */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Filtros generales</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <label>
                Desde
                <input
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                style={{ padding: 8, marginTop: 6 }}
                />
            </label>

            <label>
                Hasta
                <input
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                style={{ padding: 8, marginTop: 6 }}
                />
            </label>

            <label>
                Bodega ID
                <input
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: 100 }}
                />
            </label>
            </div>
        </div>

        {/* Ventas */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Ventas</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={salesExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Excel (rango)
            </button>

            <label>
                Venta ID (PDF)
                <input
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: 120 }}
                />
            </label>

            <button onClick={salePdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                PDF (venta)
            </button>
            </div>
        </div>

        {/* Gastos */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Gastos</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
            <label>
                Categoría ID (opcional)
                <input
                value={expensesCategoryId}
                onChange={(e) => setExpensesCategoryId(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: 140 }}
                placeholder="ej: 1"
                />
            </label>

            <button onClick={expensesExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Excel (rango)
            </button>
            <button onClick={expensesPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                PDF (rango)
            </button>
            </div>
        </div>

        {/* Inventario */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Inventario</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={inventoryExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Excel (bodega)
            </button>
            <button onClick={inventoryPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                PDF (bodega)
            </button>
            </div>
        </div>

        {/* Kardex */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Kardex (movimientos)</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
            <label style={{ minWidth: 320 }}>
                Producto
                <select
                value={kardexProductId}
                onChange={(e) => setKardexProductId(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: "100%" }}
                >
                <option value="">-- Selecciona --</option>
                {products
                    .filter((p) => p.is_active === 1)
                    .map((p) => (
                    <option key={p.id} value={p.id}>
                        #{p.id} - {p.name} {p.gramaje} ({p.unit})
                    </option>
                    ))}
                </select>
            </label>

            <button onClick={kardexExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Excel (rango)
            </button>
            <button onClick={kardexPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                PDF (rango)
            </button>
            </div>
        </div>

        {/* Nómina */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Nómina</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
            <label>
                Payroll Run ID
                <input
                value={payrollRunId}
                onChange={(e) => setPayrollRunId(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: 140 }}
                placeholder="ej: 1"
                />
            </label>

            <button onClick={payrollExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Excel
            </button>
            <button onClick={payrollPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                PDF
            </button>
            </div>
        </div>

        {/* Deudas */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Deudas / Saldos</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
            <label>
                Estado
                <select
                value={debtStatus}
                onChange={(e) => setDebtStatus(e.target.value)}
                style={{ padding: 8, marginTop: 6 }}
                >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
                </select>
            </label>

            <label style={{ minWidth: 260 }}>
                Empleado (opcional)
                <select
                value={debtEmployeeId}
                onChange={(e) => setDebtEmployeeId(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: "100%" }}
                >
                <option value="">(Todos)</option>
                {employees
                    .filter((e) => e.is_active === 1)
                    .map((e) => (
                    <option key={e.id} value={e.id}>
                        #{e.id} {e.full_name}
                    </option>
                    ))}
                </select>
            </label>

            <button onClick={debtsExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Excel
            </button>
            <button onClick={debtsPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                PDF
            </button>
            </div>
        </div>
        </div>
    );
    }