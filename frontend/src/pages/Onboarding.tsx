import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { orgApi, authApi, servicesApi, clientsApi } from "../api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OrgData {
  companyName: string;
  companyLogo: string | null;
  phone: string;
  email: string;
}

interface AdminData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "TECHNICIAN" | "VIEWER";
  method: "direct" | "invite";
}

interface ClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const STEPS = [
  { label: "Organization", icon: "building" },
  { label: "Admin Account", icon: "user" },
  { label: "Team Members", icon: "users" },
  { label: "Quick Setup", icon: "rocket" },
];

// ─────────────────────────────────────────────
// Main Onboarding Component
// ─────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Guard: redirect away if onboarding was already completed or users already exist
  useEffect(() => {
    const onboardingComplete = localStorage.getItem("am_onboarding_complete");
    if (onboardingComplete === "true") {
      navigate("/dashboard", { replace: true });
      return;
    }
    fetch("/api/auth/has-users")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasUsers) {
          navigate("/login", { replace: true });
        } else {
          setInitialCheckDone(true);
        }
      })
      .catch(() => setInitialCheckDone(true));
  }, [navigate]);

  // Step 1: Organization
  const [org, setOrg] = useState<OrgData>({
    companyName: "",
    companyLogo: null,
    phone: "",
    email: "",
  });

  // Step 2: Admin Account
  const [admin, setAdmin] = useState<AdminData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Step 3: Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Step 4: Quick Setup
  const [clientData, setClientData] = useState<ClientData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [servicesExist, setServicesExist] = useState(false);

  // Track if admin has been registered (to gate further API calls)
  const [isRegistered, setIsRegistered] = useState(false);

  // ── Step Navigation ──────────────────────────

  function goNext() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  // ── Step 1: Save Organization ──────────────────────────

  async function handleOrgNext() {
    if (!org.companyName.trim()) {
      setError("Company name is required");
      return;
    }
    // We'll save org data after registration since PUT /api/org requires auth
    goNext();
  }

  // ── Step 2: Register Admin ──────────────────────────

  async function handleAdminNext() {
    if (!admin.name.trim()) {
      setError("Full name is required");
      return;
    }
    if (!admin.email.trim()) {
      setError("Email is required");
      return;
    }
    if (admin.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (admin.password !== admin.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Register the admin user (first user gets ADMIN role)
      await register(admin.name, admin.email, admin.password, "ADMIN");
      setIsRegistered(true);

      // Now save org settings (we have a token now)
      try {
        await orgApi.update({
          companyName: org.companyName,
          companyLogo: org.companyLogo,
          phone: org.phone || null,
          email: org.email || null,
        });
      } catch {
        // Non-critical — org settings can be updated later
      }

      goNext();
    } catch (e: any) {
      setError(e.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Team Members ──────────────────────────

  async function handleTeamNext() {
    goNext();
    // Check if services exist for step 4
    try {
      const services = await servicesApi.list();
      setServicesExist(services.length > 0);
    } catch {
      setServicesExist(false);
    }
  }

  // ── Step 4: Finish Setup ──────────────────────────

  async function handleFinish() {
    setLoading(true);
    setError("");
    try {
      // Optionally create the first client
      if (clientData.firstName.trim() && clientData.lastName.trim()) {
        await clientsApi.create({
          firstName: clientData.firstName.trim(),
          lastName: clientData.lastName.trim(),
          email: clientData.email.trim() || undefined,
          phone: clientData.phone.trim() || undefined,
        });
      }

      // Set onboarding complete flag
      localStorage.setItem("am_onboarding_complete", "true");

      // Navigate to dashboard
      navigate("/dashboard", { state: { welcomeToast: true } });
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-turf-900 via-turf-800 to-turf-950 flex flex-col">
      {/* Header */}
      <div className="pt-8 pb-4 text-center">
        <img src="/am-icon.png" alt="AgenticMeadows" className="w-14 h-14 mx-auto mb-3 rounded-2xl shadow-lg" />
        <h1 className="text-2xl font-bold text-white">AgenticMeadows</h1>
        <p className="text-turf-400 text-sm mt-1">Let's set up your workspace</p>
      </div>

      {/* Progress Bar */}
      <ProgressBar currentStep={step} steps={STEPS} />

      {/* Step Content */}
      <div className="flex-1 flex items-start justify-center px-4 pb-8 pt-4">
        <div className="w-full max-w-2xl">
          {step === 0 && (
            <StepOrganization
              org={org}
              setOrg={setOrg}
              error={error}
              onNext={handleOrgNext}
            />
          )}
          {step === 1 && (
            <StepAdminAccount
              admin={admin}
              setAdmin={setAdmin}
              error={error}
              loading={loading}
              onBack={goBack}
              onNext={handleAdminNext}
            />
          )}
          {step === 2 && (
            <StepTeamMembers
              teamMembers={teamMembers}
              setTeamMembers={setTeamMembers}
              error={error}
              isRegistered={isRegistered}
              onBack={goBack}
              onNext={handleTeamNext}
              onSkip={() => {
                handleTeamNext();
              }}
            />
          )}
          {step === 3 && (
            <StepQuickSetup
              clientData={clientData}
              setClientData={setClientData}
              servicesExist={servicesExist}
              error={error}
              loading={loading}
              onBack={goBack}
              onFinish={handleFinish}
              onSkip={() => {
                localStorage.setItem("am_onboarding_complete", "true");
                navigate("/dashboard", { state: { welcomeToast: true } });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Progress Bar Component
// ─────────────────────────────────────────────

function ProgressBar({ currentStep, steps }: { currentStep: number; steps: typeof STEPS }) {
  return (
    <div className="px-4 py-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-initial">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    i < currentStep
                      ? "bg-turf-500 text-white shadow-lg shadow-turf-500/30"
                      : i === currentStep
                      ? "bg-turf-500 text-white ring-4 ring-turf-500/30 shadow-lg shadow-turf-500/30"
                      : "bg-turf-800/50 text-turf-500/50 border border-turf-700/50"
                  }`}
                >
                  {i < currentStep ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-2 font-medium whitespace-nowrap ${
                    i <= currentStep ? "text-turf-300" : "text-turf-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex-1 mx-3 mt-[-1.25rem]">
                  <div
                    className={`h-0.5 rounded-full transition-all duration-500 ${
                      i < currentStep ? "bg-turf-500" : "bg-turf-800/50"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1: Create Organization
// ─────────────────────────────────────────────

function StepOrganization({
  org,
  setOrg,
  error,
  onNext,
}: {
  org: OrgData;
  setOrg: (o: OrgData) => void;
  error: string;
  onNext: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleLogoFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo must be under 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setOrg({ ...org, companyLogo: reader.result as string });
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLogoFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  return (
    <div className="card p-8 animate-fadeIn">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-turf-50 rounded-xl mb-3">
          <svg className="w-6 h-6 text-turf-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Create Your Organization</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about your landscaping business</p>
      </div>

      <div className="space-y-5">
        {/* Logo Upload */}
        <div>
          <label className="label">Company Logo <span className="text-gray-400 font-normal">(optional)</span></label>
          <div
            className={`relative w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              dragging
                ? "border-turf-500 bg-turf-50"
                : org.companyLogo
                ? "border-gray-200 bg-gray-50"
                : "border-gray-300 bg-gray-50 hover:border-turf-400 hover:bg-turf-50/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragging(false)}
          >
            {org.companyLogo ? (
              <div className="flex items-center gap-4">
                <img
                  src={org.companyLogo}
                  alt="Logo preview"
                  className="w-20 h-20 object-contain rounded-lg"
                />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700">Logo uploaded</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrg({ ...org, companyLogo: null });
                    }}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v13.5a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-sm text-gray-500">
                  Drag & drop your logo here, or <span className="text-turf-600 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoFile(file);
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Company Name */}
        <div>
          <label className="label">
            Company Name <span className="text-red-400">*</span>
          </label>
          <input
            className="input text-base py-2.5"
            value={org.companyName}
            onChange={(e) => setOrg({ ...org, companyName: e.target.value })}
            placeholder="Green Lawn Pros"
            autoFocus
          />
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              className="input"
              type="tel"
              value={org.phone}
              onChange={(e) => setOrg({ ...org, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="label">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              className="input"
              type="email"
              value={org.email}
              onChange={(e) => setOrg({ ...org, email: e.target.value })}
              placeholder="office@company.com"
            />
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mt-8 flex justify-end">
        <button onClick={onNext} className="btn-primary py-2.5 px-6">
          Continue
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2: Create Admin Account
// ─────────────────────────────────────────────

function StepAdminAccount({
  admin,
  setAdmin,
  error,
  loading,
  onBack,
  onNext,
}: {
  admin: AdminData;
  setAdmin: (a: AdminData) => void;
  error: string;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="card p-8 animate-fadeIn">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-turf-50 rounded-xl mb-3">
          <svg className="w-6 h-6 text-turf-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Create Admin Account</h2>
        <p className="text-sm text-gray-500 mt-1">This will be the primary administrator account</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            className="input text-base py-2.5"
            value={admin.name}
            onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
            placeholder="Jane Smith"
            autoComplete="name"
            autoFocus
          />
        </div>

        <div>
          <label className="label">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            className="input text-base py-2.5"
            type="email"
            value={admin.email}
            onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
            placeholder="jane@greenlawnpros.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="label">
            Password <span className="text-red-400">*</span>
          </label>
          <input
            className="input text-base py-2.5"
            type="password"
            value={admin.password}
            onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
            placeholder="Minimum 6 characters"
            autoComplete="new-password"
            minLength={6}
          />
        </div>

        <div>
          <label className="label">
            Confirm Password <span className="text-red-400">*</span>
          </label>
          <input
            className="input text-base py-2.5"
            type="password"
            value={admin.confirmPassword}
            onChange={(e) => setAdmin({ ...admin, confirmPassword: e.target.value })}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            minLength={6}
          />
        </div>

        <div className="bg-turf-50 border border-turf-200 rounded-lg px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-turf-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-turf-800">Admin privileges</p>
              <p className="text-xs text-turf-600 mt-0.5">
                As the first user, you'll have full admin access to manage users, settings, and all features.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="btn-ghost py-2.5 px-5">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
        <button onClick={onNext} disabled={loading} className="btn-primary py-2.5 px-6">
          {loading ? (
            <>
              <LoadingSpinner />
              Creating account...
            </>
          ) : (
            <>
              Create & Continue
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3: Invite Team Members
// ─────────────────────────────────────────────

function StepTeamMembers({
  teamMembers,
  setTeamMembers,
  error,
  isRegistered,
  onBack,
  onNext,
  onSkip,
}: {
  teamMembers: TeamMember[];
  setTeamMembers: (m: TeamMember[]) => void;
  error: string;
  isRegistered: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<"direct" | "invite">("direct");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState<"TECHNICIAN" | "VIEWER">("TECHNICIAN");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteRole, setInviteRole] = useState<"TECHNICIAN" | "VIEWER">("TECHNICIAN");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect local network URL
  const hostname = window.location.hostname;
  const port = window.location.port || "3001";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const networkUrl = isLocalhost ? `http://<your-server-ip>:${port}` : `http://${hostname}:${port}`;

  async function handleDirectCreate() {
    if (!memberName.trim()) { setAddError("Name is required"); return; }
    if (!memberEmail.trim()) { setAddError("Email is required"); return; }
    if (memberPassword.length < 6) { setAddError("Password must be at least 6 characters"); return; }

    setAddLoading(true);
    setAddError("");
    try {
      const res = await authApi.register(memberName, memberEmail, memberPassword, memberRole);
      setTeamMembers([
        ...teamMembers,
        {
          id: res.user.id,
          name: memberName,
          email: memberEmail,
          role: memberRole,
          method: "direct",
        },
      ]);
      setMemberName("");
      setMemberEmail("");
      setMemberPassword("");
    } catch (e: any) {
      setAddError(e.message || "Failed to create user");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleGenerateInvite() {
    setInviteLoading(true);
    setAddError("");
    try {
      const res = await authApi.createInvite(inviteRole);
      // Build proper URL for display
      const base = isLocalhost ? `http://localhost:${port}` : `http://${hostname}:${port}`;
      setInviteUrl(`${base}/invite/${res.token}`);
      setTeamMembers([
        ...teamMembers,
        {
          id: res.token,
          name: `Invite (${inviteRole})`,
          email: "Pending registration",
          role: inviteRole,
          method: "invite",
        },
      ]);
    } catch (e: any) {
      setAddError(e.message || "Failed to generate invite link");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleCopyUrl(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="card p-8 animate-fadeIn">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-turf-50 rounded-xl mb-3">
          <svg className="w-6 h-6 text-turf-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Invite Team Members</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add your crew so they can access AgenticMeadows from their devices on the local network
        </p>
      </div>

      {/* Network URL Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">Local network access</p>
              <p className="text-xs text-gray-500 truncate font-mono">{networkUrl}</p>
            </div>
          </div>
          <button
            onClick={() => handleCopyUrl(isLocalhost ? `http://localhost:${port}` : `http://${hostname}:${port}`)}
            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            {copied ? "Copied!" : "Copy URL"}
          </button>
        </div>
        {isLocalhost && (
          <p className="text-xs text-amber-600 mt-2">
            You're accessing via localhost. Find your server's IP address (e.g., <code className="bg-amber-50 px-1 rounded">ifconfig</code>) for other devices to connect.
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          <span className="badge bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">Cloud Only</span>
          <span className="text-xs text-gray-400">Remote access from outside your network is available with AgenticMeadows Cloud</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
        <button
          onClick={() => setMode("direct")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "direct" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Create Account
        </button>
        <button
          onClick={() => setMode("invite")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "invite" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Generate Invite Link
        </button>
      </div>

      {/* Direct create form */}
      {mode === "direct" && (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Team member name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={memberPassword}
                onChange={(e) => setMemberPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as "TECHNICIAN" | "VIEWER")}
              >
                <option value="TECHNICIAN">Technician</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleDirectCreate}
            disabled={addLoading}
            className="btn-secondary w-full justify-center py-2"
          >
            {addLoading ? <><LoadingSpinner /> Adding...</> : "Add Team Member"}
          </button>
        </div>
      )}

      {/* Invite link form */}
      {mode === "invite" && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="label">Role for invited user</label>
            <select
              className="input"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "TECHNICIAN" | "VIEWER")}
            >
              <option value="TECHNICIAN">Technician</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <button
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            className="btn-secondary w-full justify-center py-2"
          >
            {inviteLoading ? <><LoadingSpinner /> Generating...</> : "Generate Invite Link"}
          </button>
          {inviteUrl && (
            <div className="bg-turf-50 border border-turf-200 rounded-lg px-4 py-3">
              <p className="text-xs text-turf-700 font-medium mb-1">Share this link with your team member:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white rounded px-2 py-1.5 text-gray-700 border border-turf-200 truncate">
                  {inviteUrl}
                </code>
                <button
                  onClick={() => handleCopyUrl(inviteUrl)}
                  className="btn-primary text-xs py-1.5 px-3 shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {addError && <ErrorBanner message={addError} />}

      {/* Team member list */}
      {teamMembers.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4">
          {teamMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-turf-100 rounded-full flex items-center justify-center text-sm font-semibold text-turf-700">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge text-[10px] ${
                  m.role === "TECHNICIAN"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  {m.role}
                </span>
                {m.method === "invite" && (
                  <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">Invite</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="mt-6 flex justify-between items-center">
        <button onClick={onBack} className="btn-ghost py-2.5 px-5">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700 font-medium py-2.5 px-3">
            Skip for now
          </button>
          <button onClick={onNext} className="btn-primary py-2.5 px-6">
            Continue
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 4: Quick Setup
// ─────────────────────────────────────────────

function StepQuickSetup({
  clientData,
  setClientData,
  servicesExist,
  error,
  loading,
  onBack,
  onFinish,
  onSkip,
}: {
  clientData: ClientData;
  setClientData: (c: ClientData) => void;
  servicesExist: boolean;
  error: string;
  loading: boolean;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="card p-8 animate-fadeIn">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-turf-50 rounded-xl mb-3">
          <svg className="w-6 h-6 text-turf-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Quick Setup</h2>
        <p className="text-sm text-gray-500 mt-1">Let's set up your first client and services</p>
      </div>

      <div className="space-y-6">
        {/* Services Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Service Catalog</h3>
          {servicesExist ? (
            <div className="bg-turf-50 border border-turf-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-turf-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-turf-800 font-medium">Default landscaping services are ready!</p>
              </div>
              <p className="text-xs text-turf-600 mt-1 ml-7">
                Your service catalog includes mowing, trimming, fertilization, and more. You can customize these in Settings later.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-600">
                No services configured yet. You can set up your service catalog in Settings after completing setup.
              </p>
            </div>
          )}
        </div>

        {/* First Client Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Add Your First Client <span className="text-gray-400 font-normal">(optional)</span>
          </h3>
          <p className="text-xs text-gray-500 mb-3">Get a head start by adding your first client</p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input
                  className="input"
                  value={clientData.firstName}
                  onChange={(e) => setClientData({ ...clientData, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  className="input"
                  value={clientData.lastName}
                  onChange={(e) => setClientData({ ...clientData, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  className="input"
                  type="email"
                  value={clientData.email}
                  onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="label">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  className="input"
                  type="tel"
                  value={clientData.phone}
                  onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="mt-8 flex justify-between items-center">
        <button onClick={onBack} className="btn-ghost py-2.5 px-5">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700 font-medium py-2.5 px-3">
            Skip for now
          </button>
          <button onClick={onFinish} disabled={loading} className="btn-primary py-2.5 px-6">
            {loading ? (
              <>
                <LoadingSpinner />
                Finishing up...
              </>
            ) : (
              <>
                Finish Setup
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-red-700">{message}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
