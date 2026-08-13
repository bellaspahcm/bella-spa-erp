# BELLA HEALTHCARE OS — CLAUDE & AI CODING INSTRUCTIONS

Before creating or modifying any Healthcare OS code, you MUST read and obey:
`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`

## NON-NEGOTIABLE LAWS:
1. **KERNEL CANDIDATE FREEZE:** H1–H12 is FROZEN. Do NOT create H13 or new Kernel engines.
2. **PRODUCT VERTICAL LAYER ONLY:** Product code belongs in `src/products/` or `src/platform/healthcare/verticals/`.
3. **CONTRACT ACCESS ONLY:** `Product → Contract → Kernel`. Do NOT query `hc_*` tables directly from Product layer.
4. **ADDITIVE MIGRATIONS:** `CREATE` product tables/indexes only. Never alter/drop Kernel columns.
5. **ZERO ENTITY DUPLICATION:** Do not recreate `Patient`, `Doctor`, or `Encounter` tables.
6. **EVENT-AFTER-PERSISTENCE:** `DB COMMIT → DOMAIN EVENT → CONSUMER`.
7. **TENANT ISOLATION (GATE 0):** Enforce `tenant_id` on all queries/services.
8. **PRE-CODING ANALYSIS:** Output `ARCHITECTURE_GATE_RESULT.md` before coding.
9. **VERIFICATION:** Run `npm run healthcare:verify` before completion.
