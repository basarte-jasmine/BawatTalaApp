import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Admin UI render crash:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f4f7f2] px-6">
          <div className="max-w-md rounded-2xl border border-[#d7e3d2] bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-[#1f2a24]">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#52606c]">
              This screen hit an unexpected error. You can reload and continue from where you left off.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full bg-[#79C943] px-5 text-sm font-semibold text-white"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
