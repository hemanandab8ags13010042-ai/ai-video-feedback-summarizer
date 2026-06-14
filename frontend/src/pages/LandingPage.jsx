import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, Sparkles, Mic, FileText, Users, Kanban, BarChart3, 
  ArrowRight, ShieldCheck, Play, ChevronDown, Check, Sun, Moon 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { isDark, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  const faqs = [
    {
      q: "How does the AI extract tasks from unstructured comments?",
      a: "Our system uses Gemini's advanced multimodal models to parse voice notes, PDFs, email transcripts, and chat logs. It understands video production jargon, separates color corrections from cuts, categorizes VFX adjustments, and automatically populates your Kanban board with estimates."
    },
    {
      q: "Can I upload audio recordings or voice notes directly?",
      a: "Yes! Clients can record or upload WAV/MP3 files. The AI transcribes the audio, performs sentiment checks, detects priorities, and extracts revisions without requiring you to manually write transcripts."
    },
    {
      q: "Does it support team members role management?",
      a: "Absolutely. The platform features Role-Based Access Control (RBAC) with specific workspaces for Clients, Editors, VFX Artists, Production Managers, and Administrators."
    },
    {
      q: "Can we integrate with MySQL databases?",
      a: "Yes. Our enterprise backend is pre-configured for high-throughput MySQL databases (e.g. Railway) with an automatic SQLite fallback for local development or sandbox environments."
    }
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-studio text-slate-100' : 'bg-gradient-light text-slate-800'}`}>
      
      {/* Navigation Header */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${
        isDark ? 'bg-[#0B0F19]/80 border-slate-800' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
              <Video className="w-5.5 h-5.5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              DigiQuest Studio
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-violet-400 transition-colors">Features</a>
            <a href="#preview" className="hover:text-violet-400 transition-colors">Workspace</a>
            <a href="#pricing" className="hover:text-violet-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-violet-400 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all ${
                isDark ? 'border-slate-800 bg-[#161D30] text-amber-400 hover:bg-slate-800' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {isAuthenticated ? (
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-lg shadow-violet-500/25 transition-all"
              >
                Go to Workspace
              </button>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium hover:text-violet-400 transition-colors">
                  Sign In
                </Link>
                <Link 
                  to="/login?register=true"
                  className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-violet-500/20 transition-all"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center relative">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-violet-500/30 bg-violet-500/10 text-violet-400 mb-8"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Next-Gen AI Video Production Management
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight mb-6"
        >
          Transform Client Feedback Into{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
            Actionable Editing Tasks
          </span>{" "}
          with AI
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          Stop wasting hours deciphering WhatsApp messages, emails, and voice notes. 
          Upload feedback, let AI analyze and assign tasks, and track revisions instantly.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <Link 
            to="/login?register=true"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-2 shadow-xl shadow-violet-500/25 transition-all"
          >
            Start Project Free
            <ArrowRight className="w-4.5 h-4.5" />
          </Link>
          <a 
            href="#preview"
            className={`w-full sm:w-auto px-8 py-4 rounded-xl font-semibold border flex items-center justify-center gap-2 transition-all ${
              isDark ? 'border-slate-800 bg-[#161D30] hover:bg-slate-800' : 'border-slate-200 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <Play className="w-4.5 h-4.5 text-cyan-400 fill-cyan-400" />
            Watch Product Demo
          </a>
        </motion.div>

        {/* Animated Dashboard Preview */}
        <motion.div 
          id="preview"
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
          className={`rounded-2xl border p-4 shadow-2xl relative overflow-hidden transition-all ${
            isDark ? 'bg-[#161D30]/80 border-slate-700' : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}
        >
          <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-500 block"></span>
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 block"></span>
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 block"></span>
              <span className={`ml-4 text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>DigiQuest Dashboard Preview</span>
            </div>
            <div className="w-24 h-2.5 rounded bg-slate-800"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-left">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-xs text-slate-500">Active Revisions</span>
              <div className="text-2xl font-bold mt-1 text-violet-400">14</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-xs text-slate-500">VFX Tasks Queued</span>
              <div className="text-2xl font-bold mt-1 text-cyan-400">8</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-xs text-slate-500">Auto Task Accuracy</span>
              <div className="text-2xl font-bold mt-1 text-emerald-400">97.8%</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-xs text-slate-500">AI Tokens Saved</span>
              <div className="text-2xl font-bold mt-1 text-amber-500">120K</div>
            </div>
          </div>

          {/* Kanban Simulation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19]/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
              <div className="font-semibold text-xs text-slate-500 mb-3 uppercase tracking-wider">New Feedback (AI Output)</div>
              <div className={`p-3.5 rounded-lg border ${isDark ? 'bg-[#161D30] border-violet-500/20' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 font-bold uppercase">HIGH PRIORITY</span>
                  <span className="text-[10px] text-slate-400">Audio Voice Note</span>
                </div>
                <div className="font-bold text-sm">"Cut the intro scene at 0:14 and boost bass"</div>
                <div className="text-xs text-slate-500 mt-2">AI suggests: Editor (2.5 hrs)</div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19]/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
              <div className="font-semibold text-xs text-slate-500 mb-3 uppercase tracking-wider">In Progress (Tasks)</div>
              <div className={`p-3.5 rounded-lg border ${isDark ? 'bg-[#161D30] border-cyan-500/20' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 font-bold uppercase">VFX Task</span>
                  <span className="text-[10px] text-slate-400">PDF Feedback</span>
                </div>
                <div className="font-bold text-sm">Remove boom mic reflection from car glass</div>
                <div className="text-xs text-slate-500 mt-2">Assigned to: VFX Artist</div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B0F19]/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
              <div className="font-semibold text-xs text-slate-500 mb-3 uppercase tracking-wider">Completed / Approved</div>
              <div className={`p-3.5 rounded-lg border opacity-60 ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold uppercase">Done</span>
                </div>
                <div className="font-bold text-sm line-through">Recalibrate HDR color grading style</div>
                <div className="text-xs text-slate-500 mt-2">Approved by client</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className={`py-20 border-t ${isDark ? 'border-slate-800 bg-[#0C1222]' : 'border-slate-200 bg-slate-50'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight mb-4">Enterprise Features Crafted for Studios</h2>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              A comprehensive system built specifically for the needs of film production, VFX timelines, and content agencies.
            </p>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Feature 1 */}
            <motion.div variants={itemVariants} className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 ${
              isDark ? 'bg-[#161D30] border-slate-800 hover:border-violet-500/30' : 'bg-white border-slate-200 hover:shadow-lg'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-3">AI Summarization</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Instantly converts pages of client emails or chaotic comments into clear, concise summaries.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div variants={itemVariants} className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 ${
              isDark ? 'bg-[#161D30] border-slate-800 hover:border-cyan-500/30' : 'bg-white border-slate-200 hover:shadow-lg'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-6">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-3">Voice Note Processing</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Upload phone voice notes or zoom calls. Gemini transcribes and extracts technical edit lists automatically.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div variants={itemVariants} className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 ${
              isDark ? 'bg-[#161D30] border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:shadow-lg'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Kanban className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-3">Task Extraction</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Classifies items automatically as 'editing' (pacing, color) or 'VFX' (compositing, rig removal).
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div variants={itemVariants} className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 ${
              isDark ? 'bg-[#161D30] border-slate-800 hover:border-violet-500/30' : 'bg-white border-slate-200 hover:shadow-lg'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-3">Team Collaboration</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Smart team matching assigns tasks based on workload analysis, notifying staff via WhatsApp/Email alerts.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div variants={itemVariants} className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 ${
              isDark ? 'bg-[#161D30] border-slate-800 hover:border-cyan-500/30' : 'bg-white border-slate-200 hover:shadow-lg'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-3">Revision Tracking</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Logs status histories and client sign-offs so managers can verify what changed and when it was completed.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div variants={itemVariants} className={`p-8 rounded-2xl border transition-all hover:-translate-y-1 ${
              isDark ? 'bg-[#161D30] border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:shadow-lg'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg mb-3">Analytics Dashboard</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Visualizes revision trends, team productivity, workload ratios, and feedback source metrics in Chart.js.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4">Flexible Plans for Creative Teams</h2>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Select the scale that fits your production pipeline, from indie creators to massive studio networks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1 */}
          <div className={`p-8 rounded-2xl border flex flex-col justify-between ${
            isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <div className="text-lg font-bold">Creator Sandbox</div>
              <div className="text-3xl font-extrabold mt-3">$0</div>
              <span className="text-xs text-slate-500">Perfect for local testing and solo editors</span>
              <ul className="mt-8 space-y-3.5 text-sm">
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Local SQLite setup</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Mock AI processing mode</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Up to 3 active projects</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Standard Kanban board</li>
              </ul>
            </div>
            <Link to="/login?register=true" className="w-full text-center mt-8 py-3 rounded-lg border font-semibold border-slate-700 hover:bg-slate-800 transition-colors">
              Get Started Free
            </Link>
          </div>

          {/* Plan 2 */}
          <div className="p-8 rounded-2xl border flex flex-col justify-between relative bg-gradient-to-b from-[#1E1B4B]/30 to-[#0F172A] border-violet-500 shadow-xl shadow-violet-500/5">
            <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-violet-600 text-white shadow-lg shadow-violet-500/20">
              Most Popular
            </div>
            <div>
              <div className="text-lg font-bold text-violet-400">Studio Team</div>
              <div className="text-3xl font-extrabold mt-3">$79<span className="text-sm font-normal text-slate-500"> / mo</span></div>
              <span className="text-xs text-slate-400">For mid-size agencies and VFX studios</span>
              <ul className="mt-8 space-y-3.5 text-sm">
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400" /> Full MySQL DB & Cloudinary host</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400" /> Live Gemini API task extraction</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400" /> Voice notes & audio multimodal scan</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400" /> Unlimited active projects</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400" /> WhatsApp & Email alerts</li>
              </ul>
            </div>
            <Link to="/login?register=true" className="w-full text-center mt-8 py-3 rounded-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 transition-colors">
              Start 14-Day Trial
            </Link>
          </div>

          {/* Plan 3 */}
          <div className={`p-8 rounded-2xl border flex flex-col justify-between ${
            isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <div className="text-lg font-bold">Production Enterprise</div>
              <div className="text-3xl font-extrabold mt-3">Custom</div>
              <span className="text-xs text-slate-500">For major studios and production companies</span>
              <ul className="mt-8 space-y-3.5 text-sm">
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Custom GPT-4o & Gemini fine-tuning</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Advanced sentiment workload reports</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> Multi-region DB replication</li>
                <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-cyan-400" /> 24/7 dedicated support representative</li>
              </ul>
            </div>
            <button className="w-full mt-8 py-3 rounded-lg border font-semibold border-slate-700 hover:bg-slate-800 transition-colors">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className={`py-20 border-t ${isDark ? 'border-slate-800 bg-[#0C1222]' : 'border-slate-200 bg-slate-50'}`}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className={`rounded-xl border transition-all ${
                  isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-5 flex items-center justify-between font-semibold text-left"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeFaq === index ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-sm leading-relaxed text-slate-400 border-t border-slate-800/20 pt-3">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 border-t text-sm ${isDark ? 'border-slate-800 bg-[#0B0F19]' : 'border-slate-200 bg-slate-100'}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white">
              <Video className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              DigiQuest Studio
            </span>
          </div>

          <div className="flex items-center gap-8 text-slate-500">
            <a href="#" className="hover:text-violet-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-violet-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-violet-400 transition-colors">Security</a>
          </div>

          <p className="text-slate-500">
            &copy; 2026 DigiQuest Studio Inc. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
