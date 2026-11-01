import React, { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import "./styles/police-portal.css";
import App from "./App.jsx";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[UniSafe] ErrorBoundary caught an unhandled render error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-white p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-800 p-8 rounded-2xl border border-rose-500/40 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="size-3 rounded-full bg-rose-500 animate-pulse" />
              <h1 className="text-xl font-bold text-rose-400">
                UniSafe Portal Exception Recovered
              </h1>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              {this.state.error?.message || "An unexpected runtime error occurred while rendering the dashboard."}
            </p>
            <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48 mb-6 border border-slate-800">
              {this.state.error?.stack || String(this.state.error)}
            </pre>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Reload Dashboard
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Reset Session & Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
