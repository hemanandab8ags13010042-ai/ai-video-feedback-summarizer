import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Video, ShieldCheck, Mail, Lock, User, PlusCircle, ArrowRight, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const { login, register, error } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('client');
  
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);

  // Password strength validation rules
  const validatePassword = (pwd) => {
    const rules = [
      { test: pwd.length >= 8, msg: 'At least 8 characters' },
      { test: /[A-Z]/.test(pwd), msg: 'One uppercase letter' },
      { test: /[a-z]/.test(pwd), msg: 'One lowercase letter' },
      { test: /[0-9]/.test(pwd), msg: 'One digit' },
      { test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd), msg: 'One special character (!@#$%...)' }
    ];
    return rules;
  };

  useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setIsRegister(true);
    } else {
      setIsRegister(false);
    }
  }, [searchParams]);

  // Pre-seeded developer accounts
  const seedAccounts = [
    { label: 'Admin', email: 'admin@studio.com', pass: 'admin123' },
    { label: 'Prod Manager', email: 'pm@studio.com', pass: 'pm123' },
    { label: 'Client', email: 'client@studio.com', pass: 'client123' },
    { label: 'Editor', email: 'editor@studio.com', pass: 'editor123' },
    { label: 'VFX Artist', email: 'vfx@studio.com', pass: 'vfx123' }
  ];

  const handleSeedLogin = async (emailAddr, passCode) => {
    setEmail(emailAddr);
    setPassword(passCode);
    setLoading(true);
    setFormError('');
    try {
      await login(emailAddr, passCode);
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !name)) {
      setFormError('Please fill out all fields.');
      return;
    }

    // Enforce password strength on registration
    if (isRegister) {
      const rules = validatePassword(password);
      const failing = rules.filter(r => !r.test);
      if (failing.length > 0) {
        setFormError('Password does not meet strength requirements.');
        setPasswordErrors(rules);
        return;
      }
    }

    setLoading(true);
    setFormError('');

    try {
      if (isRegister) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${
      isDark ? 'bg-gradient-studio text-slate-100' : 'bg-gradient-light text-slate-800'
    }`}>
      
      {/* Brand panel */}
      <div className={`flex-1 flex flex-col justify-between p-8 md:p-12 relative overflow-hidden border-b md:border-b-0 md:border-r ${
        isDark ? 'bg-[#0B0F19]/50 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-lg">
            <Video className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            DigiQuest Studio
          </span>
        </div>

        <div className="my-12 max-w-md">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6">
            Review Video Feedback Seamlessly
          </h1>
          <p className={`text-base leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Sign in to access your dashboard. Review assigned edit checklists, upload feedback documents, and track project completion metrics in real-time.
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>&copy; 2026 DigiQuest Studio</span>
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-all ${
              isDark ? 'border-slate-800 bg-[#161D30] text-amber-400' : 'border-slate-200 bg-slate-100 text-slate-600'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 max-w-2xl mx-auto w-full">
        <div className={`p-8 rounded-2xl border ${
          isDark ? 'bg-[#161D30] border-slate-800 shadow-2xl' : 'bg-white border-slate-200 shadow-md'
        }`}>
          <h2 className="text-2xl font-extrabold mb-2">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            {isRegister ? 'Set up your studio workspace profile' : 'Log in to access your project feedback pipelines'}
          </p>

          {(formError || error) && (
            <div className="mb-4 p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-500 font-medium">
              {formError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. James Cameron"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 transition-colors ${
                      isDark ? 'bg-[#0B0F19] border-slate-800 focus:border-violet-500 focus:ring-violet-500' : 'bg-slate-50 border-slate-200 focus:border-violet-500 focus:ring-violet-500'
                    }`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@studio.com"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 transition-colors ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 focus:border-violet-500 focus:ring-violet-500' : 'bg-slate-50 border-slate-200 focus:border-violet-500 focus:ring-violet-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (isRegister) setPasswordErrors(validatePassword(e.target.value));
                  }}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 transition-colors ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 focus:border-violet-500 focus:ring-violet-500' : 'bg-slate-50 border-slate-200 focus:border-violet-500 focus:ring-violet-500'
                  }`}
                />
              </div>
              {/* Password Strength Indicator — only visible during registration */}
              {isRegister && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {validatePassword(password).map((rule, idx) => (
                    <div key={idx} className={`flex items-center gap-1.5 text-xs transition-colors ${
                      rule.test
                        ? 'text-emerald-400'
                        : isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      <span>{rule.test ? '✓' : '○'}</span>
                      <span>{rule.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isRegister && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Workspace Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 transition-colors ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 focus:border-violet-500 focus:ring-violet-500' : 'bg-slate-50 border-slate-200 focus:border-violet-500 focus:ring-violet-500'
                  }`}
                >
                  <option value="client">Client (Reviews & Uploads)</option>
                  <option value="editor">Video Editor (Cuts & Color)</option>
                  <option value="vfx_artist">VFX Artist (Effects & Assets)</option>
                  <option value="pm">Production Manager (Timeline Admin)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 transition-colors mt-2"
            >
              {loading ? 'Processing...' : isRegister ? 'Register Account' : 'Sign In'}
              <ArrowRight className="w-4.5 h-4.5" />
            </button>
          </form>

          {/* Toggle login vs register */}
          <div className="mt-6 text-center text-xs">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setFormError('');
              }}
              className="text-violet-400 hover:underline font-medium"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>

          {/* Seed accounts panel */}
          <div className="mt-8 pt-6 border-t border-slate-800/40">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3.5">
              <ShieldCheck className="w-4.5 h-4.5 text-cyan-400" />
              Demo Roles (Password: username123, e.g. admin123)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {seedAccounts.map((account) => (
                <button
                  key={account.label}
                  onClick={() => handleSeedLogin(account.email, account.pass)}
                  className={`py-1.5 px-1.5 rounded border text-[10px] font-medium transition-all text-center truncate ${
                    isDark ? 'border-slate-800 bg-[#0B0F19] hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-cyan-500/40 text-slate-600'
                  }`}
                  title={`Login as ${account.label}`}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
