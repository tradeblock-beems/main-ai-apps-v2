export default function Home() {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            Analytics Dashboard
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Welcome to the Tradeblock Analytics Foundation. Track new user acquisition trends and insights.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
            <span className="text-sm font-medium">
              🚀 Phase 2 Complete: Next.js Foundation Ready
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Preview Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6">
          New User Acquisition Dashboard
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Placeholder Cards */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">📊 Bar Chart</h3>
            <p className="text-blue-600 text-sm">
              Interactive new users by day visualization (Phase 5)
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-purple-800 mb-2">📅 Date Range</h3>
            <p className="text-purple-600 text-sm">
              Toggle 7/14/30/60/90 day filters (Phase 5)
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-2">🗄️ Real Data</h3>
            <p className="text-green-600 text-sm">
              PostgreSQL fact table integration (Phase 3)
            </p>
          </div>
        </div>
      </div>

      {/* Technical Status */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Technical Foundation Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-slate-600">Next.js 15.x</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-slate-600">TypeScript 5.x</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-slate-600">D3.js 7.x</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-slate-600">Tailwind CSS</span>
          </div>
        </div>
      </div>
    </div>
  );
}