    import { useEffect, useMemo, useState } from "react";
    import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell
    } from "recharts";

    import { api } from "../services/api";
    import "./products.css";

    function money(n) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(n || 0));
    }

    function badgeForQty(qty) {
    const q = Number(qty || 0);
    if (q <= 0) return { cls: "bad", text: "Agotado" };
    if (q <= 5) return { cls: "warn", text: "Bajo" };
    return { cls: "ok", text: "OK" };
    }

    export default function Products() {
    const [warehouseId, setWarehouseId] = useState(1);
    const [rows, setRows] = useState([]); // productos + stock mergeado

    const [q, setQ] = useState("");
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // descarga de reportes con Authorization (porque abrir pestaña no manda headers)
    const downloadFile = async (path, fallbackName) => {
        setErr("");
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
        } catch (e) {
        setErr(e?.message || "Error descargando");
        }
    };

    const exportExcel = () =>
        downloadFile(`/reports/inventory.xlsx?warehouseId=${warehouseId}`, `inventario_bodega-${warehouseId}.xlsx`);

    const exportPdf = () =>
        downloadFile(`/reports/inventory.pdf?warehouseId=${warehouseId}`, `inventario_bodega-${warehouseId}.pdf`);

    async function load() {
        setErr("");
        setLoading(true);
        try {
        // ✅ 1) Productos (catálogo)
        const pRes = await api.get("/products", { params: { all: 1 } });
        const products = pRes.data?.data || [];

        // ✅ 2) Stock por bodega (cantidades)
        // Nota: este endpoint devuelve: product_id, name, gramaje, unit, quantity
        const sRes = await api.get("/inventory/stock", { params: { warehouseId } });
        const stock = sRes.data?.data || [];

        const stockMap = new Map(stock.map((s) => [Number(s.product_id), Number(s.quantity || 0)]));

        // ✅ Merge: producto + quantity
        const merged = products.map((p) => ({
            product_id: p.id,
            name: p.name,
            gramaje: p.gramaje,
            unit: p.unit,
            price: Number(p.price || 0),
            is_active: Number(p.is_active || 0),
            quantity: stockMap.get(Number(p.id)) ?? 0
        }));

        setRows(merged);
        } catch (e) {
        console.error(e);
        setErr(e?.response?.data?.message || e?.message || "Error cargando datos");
        setRows([]);
        } finally {
        setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warehouseId]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return rows.filter((r) => {
        const label = `${r.name || ""} ${r.gramaje || ""}${r.unit || ""}`.toLowerCase();
        const hit = !s || label.includes(s);
        if (!hit) return false;
        if (!onlyInStock) return true;
        return Number(r.quantity || 0) > 0;
        });
    }, [rows, q, onlyInStock]);

    const kpis = useMemo(() => {
        const activeProducts = rows.reduce((a, r) => a + (r.is_active ? 1 : 0), 0);
        const totalUnits = rows.reduce((a, r) => a + Number(r.quantity || 0), 0);
        const out = rows.reduce((a, r) => a + (Number(r.quantity || 0) <= 0 ? 1 : 0), 0);
        const value = rows.reduce((a, r) => a + Number(r.quantity || 0) * Number(r.price || 0), 0);
        return { activeProducts, totalUnits, out, value };
    }, [rows]);

    const topByQty = useMemo(() => {
        return [...rows]
        .filter((r) => r.is_active)
        .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
        .slice(0, 10)
        .map((r) => ({
            name: `${r.name} ${r.gramaje}${r.unit}`,
            qty: Number(r.quantity || 0),
        }));
    }, [rows]);

    const stockPie = useMemo(() => {
        let ok = 0, low = 0, out = 0;
        for (const r of rows.filter(x => x.is_active)) {
        const q = Number(r.quantity || 0);
        if (q <= 0) out++;
        else if (q <= 5) low++;
        else ok++;
        }
        return [
        { name: "OK", value: ok },
        { name: "Bajo", value: low },
        { name: "Agotado", value: out },
        ];
    }, [rows]);

    return (
        <div className="page">
        <div className="header">
            <div>
            <h1 className="title">Productos</h1>
            <div className="sub">
                Catálogo + Stock (bodega) · KPIs + gráficas
            </div>
            </div>

            <div className="controls">
            <input
                className="input"
                style={{ width: 260 }}
                placeholder="Buscar producto (nombre/gramaje)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
            />

            <select
                className="select"
                value={warehouseId}
                onChange={(e) => setWarehouseId(Number(e.target.value))}
            >
                <option value={1}>Bodega 1</option>
                <option value={2}>Bodega 2</option>
            </select>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)", fontSize: 12 }}>
                <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
                Solo con stock
            </label>

            <button className="btn" onClick={load}>Actualizar</button>
            <button className="btn-ghost" onClick={exportExcel}>Excel</button>
            <button className="btn-ghost" onClick={exportPdf}>PDF</button>
            </div>
        </div>

        {err ? <div className="err">{err}</div> : null}

        {/* KPIs */}
        <div className="grid">
            <div className="card">
            <h4>Productos activos</h4>
            <p className="big">{kpis.activeProducts}</p>
            <div className="sub">Catálogo activo</div>
            </div>

            <div className="card">
            <h4>Unidades en stock</h4>
            <p className="big">{kpis.totalUnits}</p>
            <div className="sub">Total en bodega seleccionada</div>
            </div>

            <div className="card">
            <h4>Agotados</h4>
            <p className="big">{kpis.out}</p>
            <div className="sub">Activos con cantidad = 0</div>
            </div>

            <div className="card">
            <h4>Valor stock (precio)</h4>
            <p className="big">{money(kpis.value)}</p>
            <div className="sub">Cantidad * precio producto</div>
            </div>
        </div>

        {/* Charts */}
        <div className="split">
            <div className="card">
            <h4>Top 10 por cantidad</h4>
            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByQty}>
                    <XAxis dataKey="name" tick={{ fill: "rgba(233,238,252,0.75)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "rgba(233,238,252,0.75)", fontSize: 11 }} />
                    <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.12)" }}
                    labelStyle={{ color: "#e9eefc" }}
                    />
                    <Bar dataKey="qty" fill="var(--accent2)" radius={[10, 10, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            <div className="card">
            <h4>Distribución de stock</h4>
            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={stockPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {stockPie.map((e, idx) => (
                        <Cell
                        key={e.name}
                        fill={idx === 0 ? "var(--accent2)" : idx === 1 ? "var(--warn)" : "var(--danger)"}
                        />
                    ))}
                    </Pie>
                    <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.12)" }}
                    labelStyle={{ color: "#e9eefc" }}
                    />
                </PieChart>
                </ResponsiveContainer>
            </div>
            </div>
        </div>

        {/* Tabla */}
        <div className="card" style={{ marginTop: 12 }}>
            <h4>Detalle</h4>

            {loading ? (
            <div className="sub">Cargando…</div>
            ) : (
            <table className="table">
                <thead>
                <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th>Valor</th>
                    <th>Estado</th>
                </tr>
                </thead>
                <tbody>
                {filtered.map((r) => {
                    const qty = Number(r.quantity || 0);
                    const b = badgeForQty(qty);
                    return (
                    <tr key={r.product_id}>
                        <td>
                        <div style={{ fontWeight: 800, opacity: r.is_active ? 1 : 0.5 }}>
                            {r.name} {!r.is_active ? "(inactivo)" : ""}
                        </div>
                        <div className="sub">{r.gramaje}{r.unit}</div>
                        </td>
                        <td>{money(r.price)}</td>
                        <td>{qty}</td>
                        <td>{money(qty * Number(r.price || 0))}</td>
                        <td><span className={`badge ${b.cls}`}>{b.text}</span></td>
                    </tr>
                    );
                })}
                {!filtered.length && (
                    <tr>
                    <td colSpan={5} className="sub">No hay resultados con esos filtros.</td>
                    </tr>
                )}
                </tbody>
            </table>
            )}
        </div>
        </div>
    );
    }