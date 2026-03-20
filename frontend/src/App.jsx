import React, { useState, useRef } from "react";
import { Upload, Map as MapIcon, Table as TableIcon, Activity, AlertTriangle, CheckCircle, Info, Maximize, Minimize, Image as ImageIcon, X } from "lucide-react";
import PlotlyPlot from 'react-plotly.js';

const Plot = PlotlyPlot.default || PlotlyPlot;

export default function App() {
  const [vachFile, setVachFile] = useState(null);
  const [truFile, setTruFile] = useState(null);
  const [tifFile, setTifFile] = useState(null);
  const [tifData, setTifData] = useState(null);   // { image_b64, bounds, filename }
  const [tifLoading, setTifLoading] = useState(false);
  const [tifError, setTifError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [forceFit, setForceFit] = useState(false);

  // --- TIF upload handler ---
  const handleTifUpload = async (file) => {
    if (!file) return;
    setTifFile(file);
    setTifError("");
    setTifLoading(true);
    setTifData(null);

    const formData = new FormData();
    formData.append("tif_file", file);

    try {
      const res = await fetch("http://localhost:8000/upload-tif", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to process TIF file.");
      }
      setTifData(data);
    } catch (err) {
      setTifError(err.message);
      setTifFile(null);
    } finally {
      setTifLoading(false);
    }
  };

  const removeTif = () => {
    setTifFile(null);
    setTifData(null);
    setTifError("");
  };

  // --- Survey upload handler ---
  const handleUpload = async () => {
    if (!vachFile || !truFile) {
      setError("Please select both Vach and Tru files.");
      return;
    }
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("vach_file", vachFile);
    formData.append("tru_file", truFile);

    try {
      const res = await fetch("http://localhost:8000/upload-survey", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to process survey files.");
      }
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStats = () => {
    if (!results) return null;
    const { total, inside, outside, avg_distance, min_distance, max_distance } = results.summary_stats;
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Poles</p>
            <p className="text-2xl font-bold text-gray-800">{total}</p>
          </div>
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Activity size={24} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Inside Boundary</p>
            <p className="text-2xl font-bold text-green-600">{inside}</p>
          </div>
          <div className="h-10 w-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Outside Boundary</p>
            <p className="text-2xl font-bold text-red-600">{outside}</p>
          </div>
          <div className="h-10 w-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Min Distance</p>
            <p className="text-2xl font-bold text-gray-800">{min_distance}m</p>
          </div>
          <div className="h-10 w-10 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center">
            <Minimize size={24} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Avg Distance</p>
            <p className="text-2xl font-bold text-gray-800">{avg_distance}m</p>
          </div>
          <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Info size={24} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Max Distance</p>
            <p className="text-2xl font-bold text-gray-800">{max_distance}m</p>
          </div>
          <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
            <Maximize size={24} />
          </div>
        </div>
      </div>
    );
  };

  // --- Mismatch calculations ---
  let mismatch = false;
  let s_xmin = 0, s_xmax = 0, s_ymin = 0, s_ymax = 0;
  if (results && results.classification) {
    const poles = results.classification || [];
    const px = poles.map(p => p.x);
    const py = poles.map(p => p.y);
    s_xmin = px.length ? Math.min(...px) : 0;
    s_xmax = px.length ? Math.max(...px) : 0;
    s_ymin = py.length ? Math.min(...py) : 0;
    s_ymax = py.length ? Math.max(...py) : 0;

    if (tifData && tifData.bounds) {
      const { x_min, x_max, y_min, y_max } = tifData.bounds;
      if (x_max < s_xmin || x_min > s_xmax || y_max < s_ymin || y_min > s_ymax || Math.abs(x_min - s_xmin) > 10000) {
        mismatch = true;
      }
    }
  }

  const renderMap = () => {
    if (!results) return null;

    // Boundary shape path
    let pathStr = "";
    if (results.boundary_points && results.boundary_points.length > 0) {
      pathStr = `M ${results.boundary_points[0].x} ${results.boundary_points[0].y}`;
      for (let i = 1; i < results.boundary_points.length; i++) {
        pathStr += ` L ${results.boundary_points[i].x} ${results.boundary_points[i].y}`;
      }
      pathStr += " Z";
    }

    const poles = results.classification || [];

    // Separate normal poles from violation poles for cleaner rendering
    const normalPoles   = poles.filter(p => !p.is_min_violation && !p.is_max_violation);
    const violationPoles = poles.filter(p => p.is_min_violation || p.is_max_violation);

    const makeText = p => {
      let desc = `Pole ID: ${p.id}<br>Status: ${p.status}<br>Dist: ${p.distance}m`;
      if (p.is_min_violation) desc += "<br><b>⚠ MIN VIOLATION</b>";
      if (p.is_max_violation) desc += "<br><b>⚠ MAX VIOLATION</b>";
      return desc;
    };

    const normalColor  = p => p.status === "INSIDE" ? "rgba(16,185,129,0.65)" : "rgba(239,68,68,0.65)";
    const violationColor = p => p.is_max_violation ? "rgba(168,85,247,0.9)" : "rgba(234,179,8,0.9)";
    
    let final_bounds = null;
    if (tifData && tifData.bounds) {
      if (forceFit && mismatch) {
        final_bounds = { x_min: s_xmin, x_max: s_xmax, y_min: s_ymin, y_max: s_ymax };
      } else {
        final_bounds = tifData.bounds;
      }
    }

    const layoutImages = [];
    if (tifData && tifData.image_b64 && final_bounds) {
      const { x_min, x_max, y_min, y_max } = final_bounds;
      layoutImages.push({
        source: `data:image/png;base64,${tifData.image_b64}`,
        xref: "x",
        yref: "y",
        x: x_min,
        y: y_max,
        sizex: (x_max - x_min) || 10,
        sizey: (y_max - y_min) || 10,
        sizing: "stretch",
        opacity: 0.85,
        layer: "below"
      });
    }

    const layout = {
      autosize: true,
      margin: { l: 20, r: 20, t: 20, b: 20 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent', // Important: transparent so CSS bg shows through, and Plotly's <rect> doesn't hide layer:'below' images!
      hovermode: 'closest',
      xaxis: {
        scaleanchor: "y",
        scaleratio: 1,
        showgrid: !tifData,
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      yaxis: {
        showgrid: !tifData,
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      images: layoutImages,
      shapes: pathStr ? [
        {
          type: 'path',
          path: pathStr,
          fillcolor: 'rgba(59, 130, 246, 0.08)',   // lighter fill – shows satellite beneath
          line: {
            color: 'rgba(99, 179, 237, 0.95)',     // bright cyan-blue – clearly visible
            width: 2.5,
            dash: 'solid'
          }
        }
      ] : []
    };

    return (
      <Plot
        data={[
          // Layer 1: Normal INSIDE / OUTSIDE poles (small, semi-transparent, no border)
          {
            x: normalPoles.map(p => p.x),
            y: normalPoles.map(p => p.y),
            mode: 'markers',
            type: 'scatter',
            name: 'Poles',
            text: normalPoles.map(makeText),
            hoverinfo: 'text',
            marker: {
              size: 5,
              color: normalPoles.map(normalColor),
              line: { width: 0 }   // no border – less noise
            }
          },
          // Layer 2: Violation poles (larger star, fully opaque, clearly visible)
          {
            x: violationPoles.map(p => p.x),
            y: violationPoles.map(p => p.y),
            mode: 'markers',
            type: 'scatter',
            name: 'Violations',
            text: violationPoles.map(makeText),
            hoverinfo: 'text',
            marker: {
              size: 12,
              symbol: 'star',
              color: violationPoles.map(violationColor),
              line: { color: 'white', width: 1 }
            }
          }
        ]}
        layout={layout}
        config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler={true}
      />
    );
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">AI Boundary Analysis</h1>
            <p className="text-gray-500 mt-2">Upload survey points and analyze potential boundary violations with AI assistance.</p>
          </div>
        </header>

        {/* === TIF Background Upload Section === */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="text-emerald-500" size={20} />
            <h2 className="font-semibold text-gray-800">GeoTIFF Background Map <span className="text-xs font-normal text-gray-400 ml-1">(tuỳ chọn)</span></h2>
          </div>

          {!tifFile ? (
            <label
              htmlFor="tif-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-xl p-8 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400 transition-all cursor-pointer group"
            >
              <ImageIcon className="text-emerald-300 group-hover:text-emerald-500 transition-colors mb-3" size={40} />
              <p className="text-sm font-semibold text-gray-700">Kéo thả hoặc click để chọn file GeoTIFF</p>
              <p className="text-xs text-gray-400 mt-1">Hỗ trợ: .tif, .tiff — Ảnh sẽ được dùng làm nền bản đồ</p>
              <input
                id="tif-upload"
                type="file"
                className="hidden"
                accept=".tif,.tiff"
                onChange={e => handleTifUpload(e.target.files[0])}
              />
            </label>
          ) : (
            <div className="flex items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
              <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                {tifLoading
                  ? <svg className="animate-spin h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  : <CheckCircle className="text-emerald-600" size={20} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{tifFile.name}</p>
                <p className="text-xs text-gray-500">
                  {tifLoading
                    ? "Đang xử lý GeoTIFF..."
                    : tifData
                      ? `✓ Đã tải — CRS: ${tifData.crs || "N/A"}`
                      : tifError || "Lỗi không xác định"
                  }
                </p>
                {tifData && tifData.bounds && (
                  <p className="text-[10px] text-emerald-600/60 mt-0.5 truncate font-mono">
                    Bounds: X({Math.round(tifData.bounds.x_min)}-{Math.round(tifData.bounds.x_max)}), Y({Math.round(tifData.bounds.y_min)}-{Math.round(tifData.bounds.y_max)})
                  </p>
                )}
                {tifError && <p className="text-xs text-red-500 mt-0.5">{tifError}</p>}
              </div>
              <button
                onClick={removeTif}
                className="flex-shrink-0 p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Xoá file TIF"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {tifData && tifData.image_b64 && (
            <div className="mt-3 rounded-xl overflow-hidden border border-emerald-100 max-h-48 flex items-center justify-center bg-gray-900">
              <img
                src={`data:image/png;base64,${tifData.image_b64}`}
                alt="GeoTIFF preview"
                className="max-h-48 object-contain"
              />
            </div>
          )}
        </section>

        {/* === Survey Files Upload Section === */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border hover:border-blue-500 transition-colors border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 relative group">
              <Upload className="text-gray-400 mb-3 group-hover:text-blue-500 transition-colors" size={32} />
              <label className="text-sm font-medium text-gray-700 mb-1 cursor-pointer w-full h-full flex flex-col items-center justify-center absolute inset-0">
                <input type="file" className="hidden" accept=".txt,.csv" onChange={e => setVachFile(e.target.files[0])} />
              </label>
              <div className="text-sm font-medium text-gray-700 mb-1 pointer-events-none">Select Boundary File</div>
              <p className="text-xs text-gray-500 pointer-events-none">{vachFile ? vachFile.name : "TXT or CSV allowed"}</p>
            </div>

            <div className="border hover:border-blue-500 transition-colors border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 relative group">
              <Upload className="text-gray-400 mb-3 group-hover:text-blue-500 transition-colors" size={32} />
              <label className="text-sm font-medium text-gray-700 mb-1 cursor-pointer w-full h-full flex flex-col items-center justify-center absolute inset-0">
                <input type="file" className="hidden" accept=".txt,.csv" onChange={e => setTruFile(e.target.files[0])} />
              </label>
              <div className="text-sm font-medium text-gray-700 mb-1 pointer-events-none">Select Poles File</div>
              <p className="text-xs text-gray-500 pointer-events-none">{truFile ? truFile.name : "TXT or CSV allowed"}</p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
            {error && <span className="text-red-500 text-sm font-medium">{error}</span>}
            {!error && <span />}
            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : "Analyze Data"}
            </button>
          </div>
        </section>

        {results && (
          <>
            {renderStats()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Map View */}
              <div className="lg:col-span-2 min-h-[500px] h-[600px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
                <div className="flex items-center gap-2 p-4 border-b border-gray-100 shrink-0">
                  <MapIcon className="text-blue-500" size={20} />
                  <h3 className="font-semibold text-gray-800">Spatial Visualization</h3>
                  {mismatch && !forceFit && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded">⚠️ TIF bị lệch toạ độ so với điểm đo</span>
                        <button onClick={() => setForceFit(true)} className="text-[11px] bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-2 py-1 rounded transition-colors">Ép khớp toạ độ</button>
                      </div>
                  )}
                  {mismatch && forceFit && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">⚠️ Đã ép TIF khớp toạ độ (Méo ảnh gốc)</span>
                        <button onClick={() => setForceFit(false)} className="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold px-2 py-1 rounded transition-colors">Huỷ ép</button>
                      </div>
                  )}
                  {tifData && !mismatch && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <ImageIcon size={11} /> TIF nền đang bật
                    </span>
                  )}
                </div>
                <div className={`flex-1 w-full relative ${tifData ? "bg-[#111827]" : "bg-slate-50"}`}>
                  {renderMap()}
                </div>
              </div>

              {/* Data and AI Panel */}
              <div className="space-y-8 flex flex-col h-[600px]">
                {/* AI Interpretation */}
                <div className="bg-indigo-50/50 rounded-2xl shadow-sm border border-indigo-100 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-indigo-100 bg-white shrink-0">
                    <Activity className="text-indigo-600" size={20} />
                    <h3 className="font-semibold text-gray-800">AI Interpretation</h3>
                  </div>
                  <div className="p-6 prose prose-sm text-gray-700 max-w-none overflow-y-auto" dangerouslySetInnerHTML={{ __html: results.ai_summary.replace(/\n/g, '<br/>') }}>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-gray-100 shrink-0">
                    <TableIcon className="text-green-500" size={20} />
                    <h3 className="font-semibold text-gray-800">Pole Analysis Data</h3>
                  </div>
                  <div className="overflow-y-auto flex-1 p-0 m-0 relative">
                    <table className="min-w-full text-left text-sm border-collapse">
                      <thead className="bg-white top-0 sticky z-10 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 font-medium text-gray-500">ID</th>
                          <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                          <th className="px-4 py-3 font-medium text-gray-500 text-right">Dist (m)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {results.classification && results.classification.map((pole, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{pole.id}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${pole.status === 'INSIDE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {pole.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{pole.distance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
