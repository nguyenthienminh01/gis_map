import React, { useState } from "react";
import { Upload, Map as MapIcon, Table as TableIcon, Activity, AlertTriangle, CheckCircle, Info, Maximize, Minimize } from "lucide-react";
import PlotlyPlot from 'react-plotly.js';

const Plot = PlotlyPlot.default || PlotlyPlot;

export default function App() {
  const [vachFile, setVachFile] = useState(null);
  const [truFile, setTruFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

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

  const renderMap = () => {
    if (!results) return null;

    // Boundary shape
    let pathStr = "";
    if (results.boundary_points && results.boundary_points.length > 0) {
      pathStr = `M ${results.boundary_points[0].x} ${results.boundary_points[0].y}`;
      for (let i = 1; i < results.boundary_points.length; i++) {
        pathStr += ` L ${results.boundary_points[i].x} ${results.boundary_points[i].y}`;
      }
      pathStr += " Z";
    }

    // Poles points
    const poles = results.classification || [];
    const x = poles.map(p => p.x);
    const y = poles.map(p => p.y);
    const text = poles.map(p => {
      let desc = `Pole ID: ${p.id}<br>Status: ${p.status}<br>Dist: ${p.distance}m`;
      if (p.is_min_violation) desc += "<br><br><b>MIN VIOLATION</b>";
      if (p.is_max_violation) desc += "<br><br><b>MAX VIOLATION</b>";
      return desc;
    });
    
    // Custom colors and sizes
    const colors = poles.map(p => {
      if (p.is_max_violation) return "#a855f7"; // purple-500
      if (p.is_min_violation) return "#eab308"; // yellow-500
      return p.status === "INSIDE" ? "#10b981" : "#ef4444";
    });
    const sizes = poles.map(p => (p.is_max_violation || p.is_min_violation) ? 14 : 8);

    const layout = {
      autosize: true,
      margin: { l: 20, r: 20, t: 20, b: 20 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f8fafc',
      hovermode: 'closest',
      xaxis: {
        scaleanchor: "y",
        scaleratio: 1,
        showgrid: true,
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      yaxis: {
        showgrid: true,
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      shapes: pathStr ? [
        {
          type: 'path',
          path: pathStr,
          fillcolor: 'rgba(59, 130, 246, 0.2)',
          line: {
            color: 'rgb(59, 130, 246)',
            width: 2
          }
        }
      ] : []
    };

    return (
      <Plot
        data={[
          {
            x: x,
            y: y,
            mode: 'markers',
            type: 'scatter',
            text: text,
            hoverinfo: 'text',
            marker: {
              size: sizes,
              color: colors,
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
                </div>
                <div className="flex-1 w-full bg-slate-50 relative">
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
