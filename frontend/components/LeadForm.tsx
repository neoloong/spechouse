"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HelpCircle, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface LeadFormProps {
  /** "compare" — used for analytics/future use */
  context?: string;
  /** Pre-filled property IDs from compare table */
  propertyIds: (string | number)[];
  /** Called when user clicks close / collapses form */
  onClose?: () => void;
  /** Pre-filled city (e.g. from search context); defaults to first property city */
  city?: string;
}

type FieldName = "name" | "phone" | "email" | "city";

interface FieldError {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
}

type FormState = "idle" | "loading" | "success" | "error";

const PHONE_DIGITS_RE = /\D/g;

function phoneDisplay(v: string) {
  const digits = v.replace(PHONE_DIGITS_RE, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Tooltip content ────────────────────────────────────────────────────────────
const WHY_WE_NEED_THIS =
  "We share your info with a licensed local agent who can answer questions, " +
  "schedule tours, and help you make informed decisions — at no cost to you.";

// ── Validation helpers ─────────────────────────────────────────────────────────
function validateFields(
  name: string,
  phone: string,
  email: string,
  city: string
): FieldError {
  const errors: FieldError = {};
  if (!name.trim() || name.trim().length < 2)
    errors.name = "Name must be at least 2 characters";
  const phoneDigits = phone.replace(PHONE_DIGITS_RE, "");
  if (!phone || phoneDigits.length < 10)
    errors.phone = "Enter a valid 10-digit phone number";
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email.trim())) errors.email = "Enter a valid email address";
  if (!city.trim()) errors.city = "City is required";
  return errors;
}

// ── LeadForm ───────────────────────────────────────────────────────────────────
export default function LeadForm({
  propertyIds,
  onClose,
  city: cityPrefill = "",
}: LeadFormProps) {
  const [formState, setFormState] = useState<FormState>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(cityPrefill);

  const handleBlur = (field: FieldName) => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const fieldErrors = touched.name || touched.phone || touched.email || touched.city
    ? validateFields(name, phone, email, city)
    : ({} as FieldError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Mark all fields touched to surface all validation errors at once
    setTouched({ name: true, phone: true, email: true, city: true });

    const errors = validateFields(name, phone, email, city);
    if (Object.keys(errors).length > 0) return;

    setFormState("loading");
    setApiError(null);

    const payload = {
      name: name.trim(),
      phone,
      email: email.trim(),
      city: city.trim(),
      propertyIds: propertyIds.map(String),
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setFormState("success");
      } else {
        setApiError(data.errors?.[0]?.message ?? "Something went wrong. Please try again.");
        setFormState("error");
      }
    } catch {
      setApiError("Network error. Please check your connection and try again.");
      setFormState("error");
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (formState === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
        <p className="text-emerald-800 font-semibold">
          We'll connect you with a local agent within 24 hours!
        </p>
        <p className="text-sm text-emerald-700/70">
          In the meantime, feel free to explore more properties.
        </p>
      </div>
    );
  }

  // ── Expanded form ─────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/20">
        <div>
          <p className="font-semibold text-sm">Get a free agent review</p>
          <p className="text-xs text-muted-foreground">
            A licensed local agent will reach out within 24 hours.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
        {/* Why we need this */}
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
          <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
          <span>{WHY_WE_NEED_THIS}</span>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="lead-name" className="text-sm font-medium">
            Full name <span className="text-destructive">*</span>
          </label>
          <Input
            id="lead-name"
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleBlur("name")}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "lead-name-error" : undefined}
          />
          {fieldErrors.name && (
            <p id="lead-name-error" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label htmlFor="lead-phone" className="text-sm font-medium">
            Phone number <span className="text-destructive">*</span>
          </label>
          <Input
            id="lead-phone"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 000-1234"
            value={phoneDisplay(phone)}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => handleBlur("phone")}
            aria-invalid={!!fieldErrors.phone}
            aria-describedby={fieldErrors.phone ? "lead-phone-error" : undefined}
          />
          {fieldErrors.phone && (
            <p id="lead-phone-error" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {fieldErrors.phone}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="lead-email" className="text-sm font-medium">
            Email address <span className="text-destructive">*</span>
          </label>
          <Input
            id="lead-email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleBlur("email")}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "lead-email-error" : undefined}
          />
          {fieldErrors.email && (
            <p id="lead-email-error" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <label htmlFor="lead-city" className="text-sm font-medium">
            City <span className="text-destructive">*</span>
          </label>
          <Input
            id="lead-city"
            type="text"
            autoComplete="address-level2"
            placeholder="San Francisco"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={() => handleBlur("city")}
            aria-invalid={!!fieldErrors.city}
            aria-describedby={fieldErrors.city ? "lead-city-error" : undefined}
          />
          {fieldErrors.city && (
            <p id="lead-city-error" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {fieldErrors.city}
            </p>
          )}
        </div>

        {/* Hidden property IDs */}
        <input type="hidden" value={propertyIds.map(String).join(",")} />

        {/* API error */}
        {formState === "error" && apiError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="submit" className="flex-1" disabled={formState === "loading"}>
            {formState === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Get my free review"
            )}
          </Button>
          {formState === "error" && (
            <Button type="button" variant="outline" onClick={() => { setFormState("idle"); setApiError(null); }}>
              Try again
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
