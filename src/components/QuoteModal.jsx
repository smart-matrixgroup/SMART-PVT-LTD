import React, { useState } from 'react';
import {
  X, CheckCircle, ArrowRight, ArrowLeft, Send,
  Sparkles, MessageSquare, Phone, Mail, Building, User, HelpCircle
} from 'lucide-react';
import { company } from '../config/company';

// Firebase is loaded on demand (dynamic import), not at module top-level,
// so every page that mounts this modal doesn't pay for the Firestore SDK
// weight up front — only an actual form submission pulls it in.
async function submitLeadToFirestore(leadRecord) {
  const [{ collection, addDoc, serverTimestamp }, { db, isFirebaseConfigured }] = await Promise.all([
    import('firebase/firestore'),
    import('../config/firebase'),
  ]);
  if (!isFirebaseConfigured) return { configured: false };
  const docRef = await addDoc(collection(db, 'leads'), { ...leadRecord, createdAt: serverTimestamp() });
  return { configured: true, id: docRef.id };
}

export default function QuoteModal({ isOpen, onClose, initialService = '' }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [leadId, setLeadId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    whatsapp: '',
    email: '',
    service: initialService || 'Website',
    budget: '50K - 100K',
    message: '',
    preferredContact: 'WhatsApp'
  });

  if (!isOpen) return null;

  const servicesList = [
    "Portfolio Website (from LKR 15,000)",
    "Corporate Business Website",
    "SMARTORIX ERP with POS",
    "Custom Business Software",
    "Mobile App (Android & iOS)",
    "Business Process Automation",
    "AI-Powered Solutions",
    "Accounting Systems Setup",
    "Tax Compliance & Schedules",
    "Audit & Assurance Support",
    "Other Custom Solutions"
  ];

  const budgetRanges = [
    "Below LKR 25,000",
    "LKR 25,000 - 50,000",
    "LKR 50,000 - 100,000",
    "LKR 100,000 - 250,000",
    "LKR 250,000+",
    "Not sure / Let's Discuss"
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = (e) => {
    if (e) e.preventDefault();
    if (step === 1 && (!formData.name || !formData.whatsapp)) {
      alert("Please fill in your Name and WhatsApp number to proceed.");
      return;
    }
    setStep(prev => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const generatedId = `LEAD-${Math.floor(1000 + Math.random() * 9000)}`;

    const leadRecord = {
      ...formData,
      status: 'New',
      source: 'website-quote-modal',
    };

    setSubmitting(true);
    try {
      const result = await submitLeadToFirestore(leadRecord);
      setLeadId(result.configured ? result.id : generatedId);
      if (!result.configured) {
        setSubmitError('Firebase not configured yet — your request wasn\'t saved automatically. Please follow up on WhatsApp.');
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit lead', err);
      setSubmitError("Couldn't submit automatically — please reach us on WhatsApp instead.");
      setLeadId(generatedId);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setStep(1);
    onClose();
  };

  const getWhatsAppLeadUrl = () => {
    const text = `Hi SMART Pvt Ltd, I submitted quote request #${leadId}.\nName: ${formData.name}\nService: ${formData.service}\nBudget: ${formData.budget}`;
    return `https://wa.me/${company.contact.whatsapp.replace('+', '')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl glass-card rounded-3xl p-6 sm:p-8 shadow-2xl border border-surface-borderHighlight/40 bg-navy-900/95 overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={handleReset}
          className="absolute top-5 right-5 p-2 rounded-xl text-text-muted hover:text-white bg-surface-card hover:bg-surface-cardHover border border-surface-border transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {!submitted ? (
          <div>
            {/* Header & Step Tracker */}
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary/20 text-primary-cyan border border-primary/30">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-primary-cyan">
                  Smart Quote Calculator
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Get a Fast, Transparent Proposal
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Step {step} of 5 — Tell us about your requirement and get expert recommendations.
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-navy-800 h-1.5 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-primary-cyan h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(step / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Form Steps */}
            <form onSubmit={step === 5 ? handleSubmit : handleNext}>
              
              {/* STEP 1: Basic Information */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-text-light mb-1.5">
                      Your Name / Contact Person <span className="text-status-danger">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="e.g. John Perera"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-light mb-1.5">
                      Company / Organization Name (Optional)
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => handleChange('company', e.target.value)}
                        placeholder="e.g. Perera Holdings or Individual"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1.5">
                        WhatsApp Number <span className="text-status-danger">*</span>
                      </label>
                      <div className="relative">
                        <MessageSquare className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                        <input
                          type="tel"
                          required
                          value={formData.whatsapp}
                          onChange={(e) => handleChange('whatsapp', e.target.value)}
                          placeholder="+94 77 123 4567"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-light mb-1.5">
                        Email Address (Optional)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          placeholder="john@example.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Service Selection */}
              {step === 2 && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-text-light mb-1">
                    Select the primary solution or service you require:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {servicesList.map((svc) => (
                      <button
                        type="button"
                        key={svc}
                        onClick={() => handleChange('service', svc)}
                        className={`p-3 rounded-xl text-left text-xs font-medium border transition-all ${
                          formData.service === svc
                            ? 'bg-primary/20 border-primary-cyan text-white shadow-glow-sm'
                            : 'bg-navy-800 border-surface-border text-text-muted hover:text-white hover:border-surface-borderHighlight'
                        }`}
                      >
                        {svc}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: Budget Range */}
              {step === 3 && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-text-light mb-1">
                    What is your approximate estimated budget?
                  </label>
                  <p className="text-[13px] text-text-muted mb-2">
                    This helps us structure the right technology stack and phased delivery plan for you.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {budgetRanges.map((b) => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => handleChange('budget', b)}
                        className={`p-3 rounded-xl text-left text-xs font-semibold border transition-all ${
                          formData.budget === b
                            ? 'bg-primary/20 border-primary-cyan text-white shadow-glow-sm'
                            : 'bg-navy-800 border-surface-border text-text-muted hover:text-white hover:border-surface-borderHighlight'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: Scope & Message Details */}
              {step === 4 && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-text-light">
                    Describe your requirements & project vision (Optional):
                  </label>
                  <textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    placeholder="E.g., We run a restaurant with 15 tables and need POS billing + inventory. Or, I need a personal portfolio with 4 projects and WhatsApp link..."
                    className="w-full p-3.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric transition-colors resize-none"
                  />
                  <div className="flex items-center gap-2 text-[13px] text-text-muted">
                    <HelpCircle className="w-3.5 h-3.5 text-primary-cyan" />
                    <span>Include any deadlines, reference links, or existing software you use.</span>
                  </div>
                </div>
              )}

              {/* STEP 5: Contact Preference & Review */}
              {step === 5 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-text-light mb-2">
                      How would you prefer our consulting team to contact you?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['WhatsApp', 'Phone', 'Email'].map((channel) => (
                        <button
                          type="button"
                          key={channel}
                          onClick={() => handleChange('preferredContact', channel)}
                          className={`p-3 rounded-xl text-center text-xs font-semibold border transition-all ${
                            formData.preferredContact === channel
                              ? 'bg-primary/20 border-primary-cyan text-white'
                              : 'bg-navy-800 border-surface-border text-text-muted hover:text-white'
                          }`}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 rounded-xl bg-navy-800/80 border border-surface-border text-xs space-y-1.5">
                    <p className="font-semibold text-white">Summary of Request:</p>
                    <p><span className="text-text-muted">Service:</span> <strong className="text-primary-cyan">{formData.service}</strong></p>
                    <p><span className="text-text-muted">Budget Tier:</span> {formData.budget}</p>
                    <p><span className="text-text-muted">Contact:</span> {formData.name} ({formData.whatsapp})</p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-surface-border/50">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white bg-surface-card border border-surface-border transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                ) : <div />}

                {step < 5 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all flex items-center gap-1.5 ml-auto"
                  >
                    Next Step <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-primary shadow-glow-sm transition-all flex items-center gap-2 ml-auto disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting...' : 'Submit Enquiry'}
                  </button>
                )}
              </div>

            </form>
          </div>
        ) : (
          /* Submission Success State */
          <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Enquiry Successfully Received
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Thank You, {formData.name}!
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto mt-2">
                Your reference ID is <strong className="text-white bg-navy-800 px-2 py-0.5 rounded border border-surface-border">{leadId}</strong>. A SMART solutions specialist will review your requirements and reach out via {formData.preferredContact}.
              </p>
              {submitError && (
                <p className="text-[13px] text-amber-400 max-w-md mx-auto mt-2">{submitError}</p>
              )}
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={getWhatsAppLeadUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-glow-sm flex items-center justify-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Connect Instantly on WhatsApp
              </a>
              <button
                onClick={handleReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-text-light bg-surface-card hover:bg-surface-cardHover border border-surface-border transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

