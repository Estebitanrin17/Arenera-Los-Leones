    import { useEffect, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";

    export default function Expenses() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);

    const [filters, setFilters] = useState({
        from: "2026-02-01",
        to: "2026-02-28",
        categoryId: ""
    });

    const [catName, setCatName] = useState("");
    const [expenseForm, setExpenseForm] = useState({
        categoryId: "",
        title: "",
        amount: "",
        expenseDate: "2026-02-23",
        vendor: "",
        paymentMethod: "CASH",
        note: ""
    });

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    const fetchAll = async () => {
        setLoading(true);
        setError("");
        setMsg("");
        try {
        const [cRes, eRes] = await Promise.all([
            api.get("/expenses/categories?all=1"),
            api.get(
            `/expenses?from=${filters.from}&to=${filters.to}${
                filters.categoryId ? `&categoryId=${filters.categoryId}` : ""
            }`
            )
        ]);
        setCategories(cRes.data.data || []);
        setExpenses(eRes.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando gastos");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.from, filters.to, filters.categoryId]);

    const downloadFile = async (path, fallbackName) => {
        setError("");
        setMsg("");
        try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:3000/api${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

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

    const exportExcel = () => {
        const q = `from=${filters.from}&to=${filters.to}${
        filters.categoryId ? `&categoryId=${filters.categoryId}` : ""
        }`;
        downloadFile(`/reports/expenses.xlsx?${q}`, `gastos_${filters.from}_a_${filters.to}.xlsx`);
    };

    const exportPdf = () => {
        const q = `from=${filters.from}&to=${filters.to}${
        filters.categoryId ? `&categoryId=${filters.categoryId}` : ""
        }`;
        downloadFile(`/reports/expenses.pdf?${q}`, `gastos_${filters.from}_a_${filters.to}.pdf`);
    };

    const createCategory = async () => {
        setError("");
        setMsg("");
        if (!isOwner) return setError("Solo OWNER");
        if (!catName.trim()) return setError("Nombre de categoría requerido");

        try {
        await api.post("/expenses/categories", { name: catName.trim() });
        setCatName("");
        setMsg("Categoría creada ✅");
        fetchAll();
        } catch (e) {
        setError(e?.response?.data?.message || "Error creando categoría");
        }
    };

    const createExpense = async (e) => {
        e.preventDefault();
        setError("");
        setMsg("");
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload = {
            categoryId: expenseForm.categoryId ? Number(expenseForm.categoryId) : undefined,
            title: expenseForm.title.trim(),
            amount: Number(expenseForm.amount),
            expenseDate: expenseForm.expenseDate,
            vendor: expenseForm.vendor.trim() || undefined,
            note: expenseForm.note.trim() || undefined,
            paymentMethod: expenseForm.paymentMethod
        };

        await api.post("/expenses", payload);
        setMsg("Gasto creado ✅");
        setExpenseForm({
            categoryId: "",
            title: "",
            amount: "",
            expenseDate: expenseForm.expenseDate,
            vendor: "",
            paymentMethod: "CASH",
            note: ""
        });
        fetchAll();
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error creando gasto");
        }
    };

    const deactivateExpense = async (id) => {
        if (!isOwner) return;
        if (!confirm("¿Desactivar gasto?")) return;
        await api.delete(`/expenses/${id}`);
        fetchAll();
    };

    const reactivateExpense = async (id) => {
        if (!isOwner) return;
        await api.patch(`/expenses/${id}/reactivate`);
        fetchAll();
    };

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Gastos</h2>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        {/* filtros + export */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 14 }}>
            <label>
            Desde
            <input
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                style={{ padding: 8, marginTop: 6 }}
            />
            </label>

            <label>
            Hasta
            <input
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                style={{ padding: 8, marginTop: 6 }}
            />
            </label>

            <label>
            Categoría
            <select
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                style={{ padding: 8, marginTop: 6, minWidth: 220 }}
            >
                <option value="">(Todas)</option>
                {categories
                .filter((c) => c.is_active === 1)
                .map((c) => (
                    <option key={c.id} value={c.id}>
                    #{c.id} {c.name}
                    </option>
                ))}
            </select>
            </label>

            <button onClick={fetchAll} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Recargar
            </button>
            <button onClick={exportExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export Excel
            </button>
            <button onClick={exportPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export PDF
            </button>
        </div>

        {/* categorías */}
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Categorías</b>
            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}>
            <label>
                Nueva categoría
                <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                style={{ padding: 8, marginTop: 6, width: 220 }}
                />
            </label>

            <button onClick={createCategory} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Crear
            </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 13 }}>
            {categories.map((c) => (
                <span
                key={c.id}
                style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 999,
                    marginRight: 8,
                    marginBottom: 8,
                    opacity: c.is_active ? 1 : 0.5
                }}
                >
                #{c.id} {c.name} {c.is_active ? "" : "(inactiva)"}
                </span>
            ))}
            </div>
        </div>

        {/* crear gasto */}
        {isOwner && (
            <form onSubmit={createExpense} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <b>Crear gasto</b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <label style={{ minWidth: 220 }}>
                Categoría
                <select
                    value={expenseForm.categoryId}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, categoryId: e.target.value }))}
                    style={{ padding: 8, marginTop: 6, width: "100%" }}
                >
                    <option value="">(Sin categoría)</option>
                    {categories
                    .filter((c) => c.is_active === 1)
                    .map((c) => (
                        <option key={c.id} value={c.id}>
                        #{c.id} {c.name}
                        </option>
                    ))}
                </select>
                </label>

                <label style={{ minWidth: 260 }}>
                Título
                <input
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, title: e.target.value }))}
                    style={{ padding: 8, marginTop: 6, width: "100%" }}
                />
                </label>

                <label>
                Monto
                <input
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, amount: e.target.value }))}
                    style={{ padding: 8, marginTop: 6, width: 140 }}
                />
                </label>

                <label>
                Fecha
                <input
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, expenseDate: e.target.value }))}
                    style={{ padding: 8, marginTop: 6 }}
                />
                </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <label style={{ minWidth: 220 }}>
                Proveedor
                <input
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, vendor: e.target.value }))}
                    style={{ padding: 8, marginTop: 6, width: "100%" }}
                />
                </label>

                <label>
                Método
                <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, paymentMethod: e.target.value }))}
                    style={{ padding: 8, marginTop: 6 }}
                >
                    <option value="CASH">CASH</option>
                    <option value="TRANSFER">TRANSFER</option>
                    <option value="CARD">CARD</option>
                    <option value="OTHER">OTHER</option>
                </select>
                </label>

                <label style={{ minWidth: 300 }}>
                Nota
                <input
                    value={expenseForm.note}
                    onChange={(e) => setExpenseForm((x) => ({ ...x, note: e.target.value }))}
                    style={{ padding: 8, marginTop: 6, width: "100%" }}
                />
                </label>

                <button type="submit" style={{ padding: "8px 12px", cursor: "pointer" }}>
                Guardar gasto
                </button>
            </div>
            </form>
        )}

        {/* listado gastos */}
        <h3>Listado</h3>
        {loading ? (
            <div>Cargando...</div>
        ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
            <thead>
                <tr>
                {["ID", "Fecha", "Categoría", "Título", "Proveedor", "Método", "Monto", "Activo", "Acciones"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    {h}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody>
                {expenses.map((e) => (
                <tr key={e.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.id}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.expense_date}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.category_name || "Sin categoría"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.title}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.vendor || ""}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.payment_method}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.amount}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.is_active ? "Sí" : "No"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {isOwner &&
                        (e.is_active ? (
                        <button onClick={() => deactivateExpense(e.id)} style={{ cursor: "pointer" }}>
                            Desactivar
                        </button>
                        ) : (
                        <button onClick={() => reactivateExpense(e.id)} style={{ cursor: "pointer" }}>
                            Reactivar
                        </button>
                        ))}
                    </td>
                </tr>
                ))}
                {!expenses.length && (
                <tr>
                    <td colSpan={9} style={{ padding: 10 }}>
                    No hay gastos en el rango.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        )}
        </div>
    );
    }