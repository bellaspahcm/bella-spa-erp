# SIDEBAR STATE OWNERSHIP GUARD
**Platform-Level Governance Document**
**Status:** ENFORCED — Ratified 2026-09-10
**Scope:** All tenants / brand presets using `beauty-erp-nav-item` sidebar primitive

---

## Core Invariant

```
For every tenant / brand preset in the system:

  INACTIVE     → exactly 1 visual owner
  HOVER        → exactly 1 visual owner, MUST NOT match active items
  ACTIVE       → exactly 1 visual owner
  ACTIVE:HOVER → exactly 1 visual owner (explicit — never undefined)
  ACTIVE SVG   → exactly 1 color owner
  ACTIVE SPAN  → exactly 1 color owner
```

---

## Mandatory CSS Patterns

### ✅ CORRECT — Hover selector MUST exclude active state

```css
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item:not(.beauty-erp-nav-item-active):hover {
  background: ... ;
  color: ... ;
}
```

### ❌ FORBIDDEN — Broad hover that leaks into active items

```css
/* FORBIDDEN — will cause active item to flicker on hover */
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item:hover { ... }
```

### ✅ REQUIRED — Explicit active:hover lock

```css
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active:hover {
  /* Only change bg brightness. Do NOT change text color. */
  background: <brightened-active-bg> !important;
}
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active:hover svg  { color: <icon-color> !important; }
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active:hover span { color: <text-color> !important; }
```

---

## State Model per Preset (Required Structure)

Every new preset MUST declare all 6 sections in order:

```css
/* 1. INACTIVE */
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item { ... }

/* 2. HOVER (non-active) */
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item:not(.beauty-erp-nav-item-active):hover { ... }
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item:not(.beauty-erp-nav-item-active):hover svg,
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item:not(.beauty-erp-nav-item-active):hover span { ... }

/* 3. ACTIVE */
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active { ... }

/* 4. ACTIVE SVG/SPAN */
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active svg  { ... }
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active span { ... }

/* 5. ACTIVE + HOVER (lock) */
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active:hover { ... }
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active:hover svg  { ... }
html[data-tenant-brand-preset="<preset>"] .beauty-erp-nav-item-active:hover span { ... }
```

---

## GUARD RULES — FAIL CONDITIONS

| #  | Condition                                                    | Result |
|----|--------------------------------------------------------------|--------|
| G1 | Same preset has >1 active owner                              | ❌ FAIL |
| G2 | Same preset has >1 hover owner                               | ❌ FAIL |
| G3 | Hover selector can match active item (broad `:hover`)        | ❌ FAIL |
| G4 | `active:hover` state is undefined / missing                  | ❌ FAIL |
| G5 | `active span` color owner is undefined                       | ❌ FAIL |
| G6 | `active svg` color owner is undefined                        | ❌ FAIL |
| G7 | Broad `span`/`svg`/`*` selector leaks across presets         | ❌ FAIL |
| G8 | Shared JSX (`sidebar.tsx`) injects tenant visual utilities   | ❌ FAIL |
| G9 | Two blocks own same state (e.g., early block + late block)   | ❌ FAIL |
| G10| `!important` escalation used to win cascade instead of fix ownership | ❌ FAIL |

---

## Verification Script (run after any nav CSS change)

```powershell
# Run from project root:
$tenants = @{
  "jade_wellness"      = "preset"
  "luxury_navy"        = "preset"
  "ocean_clean"        = "preset"
  "graphite_luxe"      = "preset"
  "bella_rose"         = "preset"
  "beauty_spa"         = "module"
  "bella_auto"         = "module"
  "bella_healthcare"   = "module"
  "industrial_cleaning"= "module"
  "pending"            = "module"
}

$fail = 0
foreach ($t in $tenants.Keys) {
  $lines = Select-String -Path "src\app\globals.css" -Pattern "beauty-erp-nav-item" |
    Where-Object { $_.Line -match [regex]::Escape($t) } |
    Select-Object -ExpandProperty Line

  $hoverBroad  = ($lines | Where-Object { $_ -match "nav-item:hover" -and $_ -notmatch ":not\(" } | Measure-Object).Count
  $activeHover = ($lines | Where-Object { $_ -match "nav-item-active:hover" -and $_ -notmatch "svg|span" } | Measure-Object).Count

  if ($hoverBroad -gt 0)   { Write-Host "FAIL G3: $t has broad hover (HoverBroad=$hoverBroad)"; $fail++ }
  if ($activeHover -eq 0)  { Write-Host "FAIL G4: $t missing active:hover"; $fail++ }
}

if ($fail -eq 0) { Write-Host "ALL PASS — Sidebar invariant satisfied" }
else             { Write-Host "TOTAL FAILS: $fail" }
```

**Required result:** `ALL PASS — Sidebar invariant satisfied`

---

## Ownership Architecture

```
sidebar.tsx
└── emits semantic class only:
    ├── .beauty-erp-nav-item          (all items)
    └── .beauty-erp-nav-item-active   (active item)
    — NO Tailwind color/bg/text utilities

globals.css
└── [data-tenant-brand-preset="<name>"]
    ├── INACTIVE    → 1 owner
    ├── HOVER       → 1 owner (:not(.active) guard MANDATORY)
    ├── ACTIVE      → 1 owner
    ├── ACTIVE SVG  → 1 owner
    ├── ACTIVE SPAN → 1 owner
    └── ACTIVE:HOVER→ 1 owner (lock — color MUST NOT change)
```

---

## Certified Presets (Audited 2026-09-10)

| Preset              | Type   | HoverBroad | Active:Hover | STATUS |
|---------------------|--------|-----------|--------------|--------|
| jade_wellness       | preset | 0         | ✅            | PASS   |
| luxury_navy         | preset | 0         | ✅            | PASS   |
| ocean_clean         | preset | 0         | ✅            | PASS   |
| graphite_luxe       | preset | 0         | ✅            | PASS   |
| bella_rose          | preset | 0         | ✅            | PASS   |
| beauty_spa          | module | 0         | ✅            | PASS   |
| bella_auto          | module | 0         | ✅            | PASS   |
| bella_healthcare    | module | 0         | ✅            | PASS   |
| industrial_cleaning | module | 0         | ✅            | PASS   |
| pending             | module | 0         | ✅            | PASS   |

---

## Adding a New Tenant

1. Copy the 6-section template from this document
2. Replace `<preset>` with your tenant name
3. Define all 5 visual states (inactive, hover, active, active-svg/span, active:hover)
4. Run the verification script — must output `ALL PASS`
5. Do NOT use broad `:hover` without `:not(.beauty-erp-nav-item-active)` guard
6. Do NOT share ownership between two CSS blocks for the same state

> **Failure to follow this guard will cause sidebar visual regression across tenants.**
