    import { useEffect, useMemo, useState } from "react";
    import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell
    } from "recharts";

    import { api } from "../services/api";   // ✅ tu estructura
    import "./products.css";

    function money(n) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(n || 0);
    }

    function stockBadge(p) {
    const st = Number(p.stock ?? 0);
    const min = Number(p.min_stock ?? 0);
    if (st <= 0) return { cls: "out", text: "Agotado" };
    if (min > 0 && st <= min) return { cls: "low", text: "Bajo" };
    return { cls: "ok", text: "OK" };
    }

    export default function Products() {
    const [products, setProducts] = useState([]);
    const [q, setQ] = useState("");
    const [onlyLow, setOnlyLow] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
        try {
            setLoading(true);
            const data = await api("/api/products"); // <- si tu backend usa /api/products
            const rows = Array.isArray(data) ? data : (data?.rows || []);
            if (alive) setProducts(rows);
        } catch (e) {
            console.error(e);
        } finally {
            if (alive) setLoading(false);
        }
        })();
        return () => { alive = false; };
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return products.filter((p) => {
        const name = (p.name || p.nombre || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const cat = (p.category_name || p.category || "").toLowerCase();

        const hit = !s || name.includes(s) || sku.includes(s) || cat.includes(s);
        if (!hit) return false;
        if (!onlyLow) return true;

        const st = Number(p.stock ?? 0);
        const min = Number(p.min_stock ?? 0);
        return st <= 0 || (min > 0 && st <= min);
        });
    }, [products, q, onlyLow]);

    const kpis = useMemo(() => {
        const total = products.length;
        let low = 0, out = 0, units = 0, valueCost = 0;

        for (const p of products) {
        const st = Number(p.stock ?? 0);
        const min = Number(p.min_stock ?? 0);
        units += st;
        valueCost += st * Number(p.cost ?? 0);

        if (st <= 0) out++;
        else if (min > 0 && st <= min) low++;
        }
        return { total, low, out, units, valueCost };
    }, [products]);

    const topCategories = useMemo(() => {
        const map = new Map();
        for (const p of products) {
        const c = p.category_name || p.category || "Sin categoría";
        map.set(c, (map.get(c) || 0) + 1);
        }
        return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    }, [products]);

    const stockStatusPie = useMemo(() => {
        const ok = Math.max(kpis.total - kpis.low - kpis.out, 0);
        return [
        { name: "OK", value: ok },
        { name: "Bajo", value: kpis.low },
        { name: "Agotado", value: kpis.out },
        ];
    }, [kpis]);

    return (
        <div className="products-wrap">
        {/* Header */}
        <div className="products-header ui-card">
            <div className="products-title">
            <h1>Productos</h1>
            <p>Catálogo + señales de reposición (enfoque empresarial).</p>
            </div>

            <div className="products-actions">
            <button className="ui-btn ui-btn--primary">+ Nuevo</button>
            <button className="ui-btn">Excel</button>
            <button className="ui-btn">PDF</button>
            </div>
        </div>

        {/* KPIs */}
        <div className="products-grid">
            <div className="ui-card kpi">
            <div className="label">Productos</div>
            <div className="value">{kpis.total}</div>
            <div className="hint">Ítems en catálogo</div>
            </div>
            <div className="ui-card kpi">
            <div className="label">Stock total</div>
            <div className="value">{kpis.units}</div>
            <div className="hint">Unidades en inventario</div>
            </div>
            <div className="ui-card kpi">
            <div className="label">Bajo mínimo</div>
            <div className="value">{kpis.low}</div>
            <div className="hint">Reposición recomendada</div>
            </div>
            <div className="ui-card kpi">
            <div className="label">Valor stock (costo)</div>
            <div className="value">{money(kpis.valueCost)}</div>
            <div className="hint">Estimado por costo</div>
            </div>
        </div>

        {/* Charts */}
        <div className="products-row">
            <div className="ui-card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Productos por categoría</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Top 6</div>

            <div style={{ height: 260, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategories}>
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,.65)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,.65)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Bar dataKey="count" fill="rgba(20,184,166,.7)" radius={[10, 10, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            <div className="ui-card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Estado de stock</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>OK vs Bajo vs Agotado</div>

            <div style={{ height: 260, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={stockStatusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {stockStatusPie.map((e, idx) => (
                        <Cell
                        key={e.name}
                        fill={idx === 0 ? "rgba(20,184,166,.75)" : idx === 1 ? "rgba(245,158,11,.75)" : "rgba(239,68,68,.75)"}
                        />
                    ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,.12)" }} />
                </PieChart>
                </ResponsiveContainer>
            </div>
            </div>
        </div>

        {/* Filtros + Tabla */}
        <div className="ui-card">
            <div className="products-filters">
            <input
                className="input"
                placeholder="Buscar por nombre, SKU o categoría…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ minWidth: 260 }}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)", fontSize: 13 }}>
                <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
                Solo bajo mínimo / agotados
            </label>
            </div>

            <div style={{ padding: 12 }}>
            {loading ? (
                <div style={{ color: "var(--muted)" }}>Cargando…</div>
            ) : (
                <table className="ui-table">
                <thead>
                    <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Costo</th>
                    <th>Stock</th>
                    <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((p) => {
                    const b = stockBadge(p);
                    return (
                        <tr key={p.id || p.product_id || p.sku}>
                        <td>
                            <div style={{ fontWeight: 800 }}>{p.name || p.nombre}</div>
                            <div style={{ color: "var(--muted)", fontSize: 12 }}>{p.sku || "—"}</div>
                        </td>
                        <td>{p.category_name || p.category || "—"}</td>
                        <td>{money(p.price)}</td>
                        <td>{money(p.cost)}</td>
                        <td>{p.stock ?? 0}</td>
                        <td><span className={`badge ${b.cls}`}>{b.text}</span></td>
                        </tr>
                    );
                    })}
                    {!filtered.length && (
                    <tr>
                        <td colSpan={6} style={{ color: "var(--muted)" }}>
                        No hay resultados con esos filtros.
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            )}
            </div>
        </div>
        </div>
    );
    }