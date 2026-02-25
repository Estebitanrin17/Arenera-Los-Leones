    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";

    export default function Inventory() {
    const [warehouseId, setWarehouseId] = useState(1);

    const [products, setProducts] = useState([]);
    const [stock, setStock] = useState([]);

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    // form movimiento
    const [mov, setMov] = useState({
        productId: "",
        type: "IN",
        quantity: "",
        note: ""
    });

    const selectedProduct = useMemo(() => {
        const id = Number(mov.productId);
        return products.find((p) => p.id === id) || null;
    }, [mov.productId, products]);

    const fetchAll = async () => {
        setLoading(true);
        setError("");
        setMsg("");
        try {
        const [pRes, sRes] = await Promise.all([
            api.get("/products?all=1"),
            api.get(`/inventory/stock?warehouseId=${warehouseId}`)
        ]);
        setProducts(pRes.data.data || []);
        setStock(sRes.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando inventario");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warehouseId]);

    const onMovChange = (k) => (e) => setMov((m) => ({ ...m, [k]: e.target.value }));

    const submitMovement = async (e) => {
        e.preventDefault();
        setError("");
        setMsg("");

        const payload = {
        warehouseId: Number(warehouseId),
        productId: Number(mov.productId),
        type: mov.type,
        quantity: Number(mov.quantity),
        note: mov.note?.trim() || undefined
        };

        try {
        await api.post("/inventory/movements", payload);
        setMsg("Movimiento registrado ✅");
        setMov({ productId: "", type: "IN", quantity: "", note: "" });
        fetchAll();
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error registrando movimiento");
        }
    };

    // exports (abre en pestaña nueva, el navegador descarga)
    const openExport = (path) => {
        const token = localStorage.getItem("token");
        // Si tu backend exige Authorization, abrir en nueva pestaña NO manda headers.
        // Solución rápida: permitir estos reportes por query token o descargar por fetch.
        // Por ahora: descargamos por fetch con token y forzamos descarga.
        downloadFile(path);
    };

    const downloadFile = async (path) => {
        setError("");
        setMsg("");
        try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:3000/api${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || "Error descargando archivo");
        }
        const blob = await res.blob();

        // nombre desde content-disposition si existe
        const cd = res.headers.get("content-disposition") || "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] || "reporte";

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

    const exportInventoryExcel = () =>
        openExport(`/reports/inventory.xlsx?warehouseId=${warehouseId}`);

    const exportInventoryPdf = () =>
        openExport(`/reports/inventory.pdf?warehouseId=${warehouseId}`);

    const exportKardexExcel = () => {
        if (!mov.productId) return setError("Selecciona un producto para exportar kardex");
        const from = prompt("Desde (YYYY-MM-DD):", "2026-02-01");
        const to = prompt("Hasta (YYYY-MM-DD):", "2026-02-28");
        if (!from || !to) return;
        openExport(
        `/reports/kardex.xlsx?warehouseId=${warehouseId}&productId=${mov.productId}&from=${from}&to=${to}`
        );
    };

    const exportKardexPdf = () => {
        if (!mov.productId) return setError("Selecciona un producto para exportar kardex");
        const from = prompt("Desde (YYYY-MM-DD):", "2026-02-01");
        const to = prompt("Hasta (YYYY-MM-DD):", "2026-02-28");
        if (!from || !to) return;
        openExport(
        `/reports/kardex.pdf?warehouseId=${warehouseId}&productId=${mov.productId}&from=${from}&to=${to}`
        );
    };

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Inventario</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <label>
            Bodega ID:&nbsp;
            <input
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={{ width: 80, padding: 6 }}
            />
            </label>

            <button onClick={fetchAll} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Recargar
            </button>

            <button onClick={exportInventoryExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export Inventario Excel
            </button>

            <button onClick={exportInventoryPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export Inventario PDF
            </button>
        </div>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        {/* Form movimientos */}
        <form
            onSubmit={submitMovement}
            style={{
            display: "grid",
            gap: 10,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            maxWidth: 650,
            marginBottom: 16
            }}
        >
            <b>Registrar movimiento</b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ minWidth: 260 }}>
                Producto
                <select
                value={mov.productId}
                onChange={onMovChange("productId")}
                style={{ width: "100%", padding: 8, marginTop: 6 }}
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

            <label>
                Tipo
                <select
                value={mov.type}
                onChange={onMovChange("type")}
                style={{ padding: 8, marginTop: 6 }}
                >
                <option value="IN">IN (Entrada)</option>
                <option value="OUT">OUT (Salida)</option>
                <option value="ADJUST">ADJUST (Ajuste)</option>
                </select>
            </label>

            <label>
                Cantidad
                <input
                value={mov.quantity}
                onChange={onMovChange("quantity")}
                style={{ padding: 8, marginTop: 6, width: 120 }}
                placeholder="ej: 10"
                />
            </label>
            </div>

            <label>
            Nota
            <input
                value={mov.note}
                onChange={onMovChange("note")}
                style={{ width: "100%", padding: 8, marginTop: 6 }}
                placeholder="ej: Producción del día / Venta / Ajuste"
            />
            </label>

            <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" style={{ padding: "8px 12px", cursor: "pointer" }}>
                Guardar movimiento
            </button>

            <button
                type="button"
                onClick={exportKardexExcel}
                style={{ padding: "8px 12px", cursor: "pointer" }}
                disabled={!mov.productId}
            >
                Export Kardex Excel (producto)
            </button>

            <button
                type="button"
                onClick={exportKardexPdf}
                style={{ padding: "8px 12px", cursor: "pointer" }}
                disabled={!mov.productId}
            >
                Export Kardex PDF (producto)
            </button>
            </div>

            {selectedProduct && (
            <div style={{ fontSize: 12, color: "#333" }}>
                Seleccionado: <b>{selectedProduct.name}</b> {selectedProduct.gramaje} ({selectedProduct.unit})
            </div>
            )}
        </form>

        {/* Tabla stock */}
        <h3>Stock actual</h3>
        {loading ? (
            <div>Cargando...</div>
        ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
            <thead>
                <tr>
                {["Producto ID", "Nombre", "Gramaje", "Unidad", "Cantidad"].map((h) => (
                    <th
                    key={h}
                    style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}
                    >
                    {h}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody>
                {stock.map((r) => (
                <tr key={r.product_id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.product_id}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.name}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.gramaje}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.unit}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.quantity}</td>
                </tr>
                ))}
                {!stock.length && (
                <tr>
                    <td colSpan={5} style={{ padding: 10 }}>
                    No hay stock para esta bodega.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        )}
        </div>
    );
    }