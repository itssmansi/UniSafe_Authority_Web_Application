import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Eye, EyeOff, ArrowLeft, ArrowRight, ShieldCheck, Building2, Shield } from 'lucide-react';

const DEPARTMENTS = [
  {
    id: 'POLICE',
    label: 'Mumbai Police',
    desc: 'Law enforcement & dispatch',
    icon: Shield,
    placeholder: 'e.g. Officer Sharma',
  },
  {
    id: 'BMC',
    label: 'BMC Corporation',
    desc: 'Civic infra & municipal services',
    icon: Building2,
    placeholder: 'e.g. Ward Officer Patil',
  },
];

export default function AuthorityLoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();

  const [department, setDepartment] = useState('BMC');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeDept = DEPARTMENTS.find((d) => d.id === department) || DEPARTMENTS[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your official name or identifier.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('authority-login', {
        body: { name: name.trim(), department, password },
      });

      if (error) {
        let details;
        try {
          details = await error.context?.clone?.().json();
        } catch {
          /* fallback */
        }
        throw new Error(
          details?.message || error.message || 'Authentication failed. Please verify credentials.'
        );
      }

      if (!data?.success || !data.authority || !data.access_token || !data.refresh_token) {
        throw new Error(data?.message || 'Authentication failed. Invalid authority response.');
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw new Error(`Session error: ${sessionError.message}`);

      localStorage.setItem(
        'unisafe_authority',
        JSON.stringify({
          ...data.authority,
          auth_user_id: data.authority.auth_user_id || data.user_id,
          role: 'authority',
          user_type: 'authority',
        })
      );
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: data.user_id,
          role: 'authority',
          name: data.authority.name,
          department: data.authority.department,
        })
      );

      if (onLoginSuccess) {
        await onLoginSuccess();
      }

      setSuccessMsg('Signed in. Opening dashboard...');

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 350);
    } catch (err) {
      console.error('Authority login failed:', err);
      setErrorMsg(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-white font-sans text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white overflow-hidden">
      {/* ================= LEFT VISUAL HERO PANEL ================= */}
      <div className="relative w-full lg:w-1/2 h-full flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 overflow-hidden bg-neutral-900 text-white shrink-0">
        {/* Background Image */}
        <img
          src="https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=2930&auto=format&fit=crop"
          alt="Urban landscape"
          className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-900/40 pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-white text-neutral-950 flex items-center justify-center font-bold text-xs tracking-tight shadow-sm">
              <ShieldCheck className="w-4 h-4 text-neutral-950 stroke-[2.3]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight leading-none text-white">UniSafe</span>
              <span className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase">Command Portal</span>
            </div>
          </Link>
          <div className="flex items-center gap-2 bg-neutral-900/80 backdrop-blur border border-neutral-700/60 px-3 py-1 rounded-full text-xs text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Encrypted Session</span>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="relative z-10 my-auto py-12 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs text-neutral-200 mb-6">
            <span>Restricted Access</span>
            <span className="text-neutral-400">/</span>
            <span className="font-medium text-white">Official Personnel Only</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-white leading-[1.15]">
            Unified Civic &amp; <br />
            <span className="font-medium italic">Safety Operations</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-neutral-300 font-light leading-relaxed">
            Authorized dashboard for Brihanmumbai Municipal Corporation officers and Mumbai Police personnel.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 pt-6 border-t border-white/10 max-w-sm">
            <div>
              <p className="text-xl font-bold tracking-tight text-white">BMC &amp; Police</p>
              <p className="text-xs text-neutral-400 font-light mt-0.5">Dual-department routing</p>
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-white">Real-Time</p>
              <p className="text-xs text-neutral-400 font-light mt-0.5">Kanban &amp; dispatch hub</p>
            </div>
          </div>
        </div>

        {/* Bottom Metadata */}
        <div className="relative z-10 flex items-center justify-between text-xs text-neutral-400 font-light">
          <span>&copy; {new Date().getFullYear()} UniSafe FYP Portal</span>
          <span>Mumbai Jurisdiction</span>
        </div>
      </div>

      {/* ================= RIGHT FORM PANEL ================= */}
      <div className="w-full lg:w-1/2 h-full flex flex-col justify-between p-6 sm:p-8 lg:p-12 xl:p-16 overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto py-6">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-950">
              Authority Sign In
            </h2>
            <p className="mt-2 text-sm text-neutral-500 font-light">
              Choose your department and sign in with your official authority credentials.
            </p>
          </div>

          {/* Department Selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Select Department
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DEPARTMENTS.map((dept) => {
                const IconComponent = dept.icon;
                const isSelected = department === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setDepartment(dept.id);
                      setErrorMsg('');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-neutral-950 bg-neutral-950 text-white shadow-md'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {dept.id}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{dept.label}</div>
                      <div
                        className={`text-[11px] mt-0.5 leading-tight ${
                          isSelected ? 'text-neutral-300' : 'text-neutral-500'
                        }`}
                      >
                        {dept.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error & Success Alerts */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
                <span className="font-bold text-red-800 shrink-0">Error:</span>
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-in fade-in">
                <span className="font-bold text-emerald-800 shrink-0">Success:</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* Officer Name / Identifier */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                Official Identifier / Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={activeDept.placeholder}
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950 transition-all disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter authority password"
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950 transition-all disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm hover:shadow"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In as {department === 'BMC' ? 'BMC Official' : 'Police Officer'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Notice */}
          <div className="mt-8 pt-6 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 leading-relaxed">
              <span className="font-semibold text-neutral-700">Notice:</span> Access to this authority
              terminal is strictly logged and audited under Maharashtra Municipal &amp; State Police
              cyber regulations.
            </p>
          </div>
        </div>

        {/* Form Footer */}
        <div className="w-full max-w-md mx-auto pt-4 flex items-center justify-between text-xs text-neutral-400 font-light">
          <span>UniSafe Authority Portal v1.0</span>
          <span>Departmental Gateway</span>
        </div>
      </div>
    </div>
  );
}
