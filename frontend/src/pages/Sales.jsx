    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";

    export default function Sales() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [selected, setSelected] = useState(null);

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    // Crear venta
    const [saleForm, setSaleForm] = useState({
        warehouseId: 1,
        customerName: "Cliente mostrador",
        customerPhone: "",
        discount: 0,
        note: "",
        items: [{ productId: "", quantity: 1, unitPrice: "" }]
    });

    // pagos/reembolsos
    const [payForm, setPayForm] = useState({ amount: "", method: "CASH", note: "" });
    const [refForm, setRefForm] = useState({ amount: "", method: "CASH", note: "" });

    const fetchInit = async () => {
        setLoading(true);
        setError("");
        setMsg("");
        try {
        const [pRes, sRes] = await Promise.all([api.get("/products?all=1"), api.get("/sales")]);
        setProducts(pRes.data.data || []);
        setSales(sRes.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando ventas");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchInit();
    }, []);

    const fetchSale = async (id) => {
        setError("");
        setMsg("");
        try {
        const { data } = await api.get(`/sales/${id}`);
        setSelected(data.data);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando detalle");
        }
    };

    const onSaleChange = (k) => (e) => setSaleForm((s) => ({ ...s, [k]: e.target.value }));

    const updateItem = (idx, key, value) => {
        setSaleForm((s) => {
        const items = s.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
        return { ...s, items };
        });
    };

    const addItem = () =>
        setSaleForm((s) => ({ ...s, items: [...s.items, { productId: "", quantity: 1, unitPrice: "" }] }));

    const removeItem = (idx) =>
        setSaleForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));

    const createSale = async (e) => {
        e.preventDefault();
        setError("");
        setMsg("");

        const payload = {
        warehouseId: Number(saleForm.warehouseId),
        customerName: saleForm.customerName?.trim() || undefined,
        customerPhone: saleForm.customerPhone?.trim() || undefined,
        discount: Number(saleForm.discount || 0),
        note: saleForm.note?.trim() || undefined,
        items: saleForm.items.map((it) => ({
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            ...(it.unitPrice !== "" ? { unitPrice: Number(it.unitPrice) } : {})
        }))
        };

        try {
        const { data } = await api.post("/sales", payload);
        setMsg("Venta creada ✅");
        await fetchInit();
        setSelected(data.data);
        setSaleForm({
            warehouseId: 1,
            customerName: "Cliente mostrador",
            customerPhone: "",
            discount: 0,
            note: "",
            items: [{ productId: "", quantity: 1, unitPrice: "" }]
        });
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error creando venta");
        }
    };

    const addPayment = async () => {
        if (!selected) return;
        setError("");
        setMsg("");
        try {
        const payload = {
            amount: Number(payForm.amount),
            method: payForm.method,
            note: payForm.note?.trim() || undefined
        };
        const { data } = await api.post(`/sales/${selected.id}/payments`, payload);
        setSelected(data.data);
        setPayForm({ amount: "", method: "CASH", note: "" });
        setMsg("Pago registrado ✅");
        fetchInit();
        } catch (e) {
        setError(e?.response?.data?.message || "Error registrando pago");
        }
    };

    const addRefund = async () => {
        if (!selected) return;
        if (!isOwner) return setError("Solo OWNER puede reembolsar");
        setError("");
        setMsg("");
        try {
        const payload = {
            amount: Number(refForm.amount),
            method: refForm.method,
            note: refForm.note?.trim() || undefined
        };
        const { data } = await api.post(`/sales/${selected.id}/refunds`, payload);
        setSelected(data.data);
        setRefForm({ amount: "", method: "CASH", note: "" });
        setMsg("Reembolso registrado ✅");
        fetchInit();
        } catch (e) {
        setError(e?.response?.data?.message || "Error registrando reembolso");
        }
    };

    const cancelSale = async () => {
        if (!selected) return;
        if (!isOwner) return setError("Solo OWNER puede cancelar");
        if (!confirm("¿Cancelar venta? Esto devuelve stock.")) return;

        setError("");
        setMsg("");
        try {
        const { data } = await api.post(`/sales/${selected.id}/cancel`, {});
        setSelected(data.data);
        setMsg("Venta cancelada ✅");
        fetchInit();
        } catch (e) {
        setError(e?.response?.data?.message || "Error cancelando venta");
        }
    };

    // descargar archivos (igual que Inventario)
    const downloadFile = async (path, filenameFallback) => {
        try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:3000/api${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

        const blob = await res.blob();
        const cd = res.headers.get("content-disposition") || "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] || filenameFallback || "reporte";

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const exportSalePdf = () => {
        if (!selected) return;
        downloadFile(`/reports/sales/${selected.id}/pdf`, `venta-${selected.id}.pdf`);
    };

    const exportSalesExcel = () => {
        const from = prompt("Desde (YYYY-MM-DD):", "2026-02-01");
        const to = prompt("Hasta (YYYY-MM-DD):", "2026-02-28");
        if (!from || !to) return;
        downloadFile(`/reports/sales.xlsx?from=${from}&to=${to}`, `ventas_${from}_a_${to}.xlsx`);
    };

    const selectedTotals = useMemo(() => {
        if (!selected) return { paid: 0, refunded: 0, netPaid: 0 };
        const paid = (selected.payments || []).reduce((a, p) => a + Number(p.amount), 0);
        const refunded = (selected.refunds || []).reduce((a, r) => a + Number(r.amount), 0);
        return { paid, refunded, netPaid: paid - refunded };
    }, [selected]);

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Ventas</h2>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button onClick={fetchInit} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Recargar
            </button>

            <button onClick={exportSalesExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export Ventas Excel (rango)
            </button>
        </div>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        {/* Crear venta */}
        <form
            onSubmit={createSale}
            style={{
            display: "grid",
            gap: 10,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            marginBottom: 16
            }}
        >
            <b>Crear venta</b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label>
                Bodega ID
                <input
                value={saleForm.warehouseId}
                onChange={onSaleChange("warehouseId")}
                style={{ padding: 8, marginTop: 6, width: 90 }}
                />
            </label>

            <label style={{ minWidth: 240 }}>
                Cliente
                <input
                value={saleForm.customerName}
                onChange={onSaleChange("customerName")}
                style={{ padding: 8, marginTop: 6, width: "100%" }}
                />
            </label>

            <label>
                Teléfono
                <input
                value={saleForm.customerPhone}
                onChange={onSaleChange("customerPhone")}
                style={{ padding: 8, marginTop: 6, width: 140 }}
                />
            </label>

            <label>
                Descuento
                <input
                value={saleForm.discount}
                onChange={onSaleChange("discount")}
                style={{ padding: 8, marginTop: 6, width: 120 }}
                />
            </label>
            </div>

            <label>
            Nota
            <input
                value={saleForm.note}
                onChange={onSaleChange("note")}
                style={{ padding: 8, marginTop: 6, width: "100%" }}
            />
            </label>

            <div style={{ marginTop: 6 }}>
            <b>Items</b>
            {saleForm.items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ minWidth: 260 }}>
                    Producto
                    <select
                    value={it.productId}
                    onChange={(e) => updateItem(idx, "productId", e.target.value)}
                    style={{ width: "100%", padding: 8, marginTop: 6 }}
                    >
                    <option value="">-- Selecciona --</option>
                    {products
                        .filter((p) => p.is_active === 1)
                        .map((p) => (
                        <option key={p.id} value={p.id}>
                            #{p.id} - {p.name} {p.gramaje} ({p.unit}) - ${p.price}
                        </option>
                        ))}
                    </select>
                </label>

                <label>
                    Cantidad
                    <input
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                    style={{ padding: 8, marginTop: 6, width: 110 }}
                    />
                </label>

                <label>
                    Precio unit (opcional)
                    <input
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                    style={{ padding: 8, marginTop: 6, width: 160 }}
                    placeholder="dejar vacío = usa precio del producto"
                    />
                </label>

                {saleForm.items.length > 1 && (
                    <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{ padding: "8px 12px", cursor: "pointer" }}
                    >
                    Quitar
                    </button>
                )}
                </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={addItem} style={{ padding: "8px 12px", cursor: "pointer" }}>
                + Agregar item
                </button>

                <button type="submit" style={{ padding: "8px 12px", cursor: "pointer" }}>
                Crear venta
                </button>
            </div>
            </div>
        </form>

        {/* Listado + detalle */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
            <h3>Listado</h3>
            {loading ? (
                <div>Cargando...</div>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
                <thead>
                    <tr>
                    {["ID", "Fecha", "Estado", "Cliente", "Total", "Acción"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                        {h}
                        </th>
                    ))}
                    </tr>
                </thead>
                <tbody>
                    {sales.map((s) => (
                    <tr key={s.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{s.id}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                        {new Date(s.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{s.status}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{s.customer_name || ""}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{s.total}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                        <button onClick={() => fetchSale(s.id)} style={{ cursor: "pointer" }}>
                            Ver
                        </button>
                        </td>
                    </tr>
                    ))}
                    {!sales.length && (
                    <tr>
                        <td colSpan={6} style={{ padding: 10 }}>
                        No hay ventas.
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            )}
            </div>

            <div>
            <h3>Detalle</h3>
            {!selected ? (
                <div>Selecciona una venta.</div>
            ) : (
                <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                    <b>Venta #{selected.id}</b>
                    <div>Estado: {selected.status}</div>
                    <div>Cliente: {selected.customer_name || "N/A"}</div>
                    <div>Total: {selected.total}</div>
                    <div>
                        Pagado: {selectedTotals.paid} — Reembolsado: {selectedTotals.refunded} — Neto:{" "}
                        {selectedTotals.netPaid}
                    </div>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                    <button onClick={exportSalePdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                        Export PDF venta
                    </button>

                    {isOwner && (
                        <button onClick={cancelSale} style={{ padding: "8px 12px", cursor: "pointer" }}>
                        Cancelar venta
                        </button>
                    )}
                    </div>
                </div>

                <hr />

                <b>Items</b>
                <ul>
                    {selected.items.map((it) => (
                    <li key={it.id}>
                        {it.product_name} {it.gramaje} — qty {it.quantity} — unit {it.unit_price} — total{" "}
                        {it.line_total}
                    </li>
                    ))}
                </ul>

                <hr />

                <b>Pagos</b>
                <ul>
                    {(selected.payments || []).map((p) => (
                    <li key={p.id}>
                        {p.method} — {p.amount} — {p.note || ""} — {new Date(p.created_at).toLocaleString()}
                    </li>
                    ))}
                    {!selected.payments?.length && <li>No hay pagos.</li>}
                </ul>

                <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                    <label>
                    Monto
                    <input
                        value={payForm.amount}
                        onChange={(e) => setPayForm((x) => ({ ...x, amount: e.target.value }))}
                        style={{ padding: 8, marginTop: 6, width: 140 }}
                    />
                    </label>

                    <label>
                    Método
                    <select
                        value={payForm.method}
                        onChange={(e) => setPayForm((x) => ({ ...x, method: e.target.value }))}
                        style={{ padding: 8, marginTop: 6 }}
                    >
                        <option value="CASH">CASH</option>
                        <option value="TRANSFER">TRANSFER</option>
                        <option value="CARD">CARD</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                    </label>

                    <label style={{ minWidth: 240 }}>
                    Nota
                    <input
                        value={payForm.note}
                        onChange={(e) => setPayForm((x) => ({ ...x, note: e.target.value }))}
                        style={{ padding: 8, marginTop: 6, width: "100%" }}
                    />
                    </label>

                    <button onClick={addPayment} style={{ padding: "8px 12px", cursor: "pointer" }}>
                    Agregar pago
                    </button>
                </div>

                <hr />

                <b>Reembolsos</b>
                <ul>
                    {(selected.refunds || []).map((r) => (
                    <li key={r.id}>
                        {r.method} — {r.amount} — {r.note || ""} — {new Date(r.created_at).toLocaleString()}
                    </li>
                    ))}
                    {!selected.refunds?.length && <li>No hay reembolsos.</li>}
                </ul>

                {isOwner && (
                    <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                    <label>
                        Monto
                        <input
                        value={refForm.amount}
                        onChange={(e) => setRefForm((x) => ({ ...x, amount: e.target.value }))}
                        style={{ padding: 8, marginTop: 6, width: 140 }}
                        />
                    </label>

                    <label>
                        Método
                        <select
                        value={refForm.method}
                        onChange={(e) => setRefForm((x) => ({ ...x, method: e.target.value }))}
                        style={{ padding: 8, marginTop: 6 }}
                        >
                        <option value="CASH">CASH</option>
                        <option value="TRANSFER">TRANSFER</option>
                        <option value="CARD">CARD</option>
                        <option value="OTHER">OTHER</option>
                        </select>
                    </label>

                    <label style={{ minWidth: 240 }}>
                        Nota
                        <input
                        value={refForm.note}
                        onChange={(e) => setRefForm((x) => ({ ...x, note: e.target.value }))}
                        style={{ padding: 8, marginTop: 6, width: "100%" }}
                        />
                    </label>

                    <button onClick={addRefund} style={{ padding: "8px 12px", cursor: "pointer" }}>
                        Agregar reembolso
                    </button>
                    </div>
                )}
                </div>
            )}
            </div>
        </div>
        </div>
    );
    }