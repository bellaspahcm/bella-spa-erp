# BELLA HEALTHCARE & EDUCATION OS — CLAUDE & AI CODING INSTRUCTIONS

Before creating or modifying any code, you MUST read and obey:
- **Healthcare OS Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
- **Education OS Constitution:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`

## NON-NEGOTIABLE LAWS:
1. **KERNEL CANDIDATE FREEZE:** Boundedcontext kernels are FROZEN. Do NOT create core engines without approval.
2. **PRODUCT VERTICAL LAYER ONLY:** Product code belongs in `src/products/`.
3. **CONTRACT ACCESS ONLY:** `Product → Contract → Kernel`. Do NOT query `hc_*` or internal vertical tables directly from Product layer.
4. **ADDITIVE MIGRATIONS:** `CREATE` product tables/indexes only. Never alter/drop Kernel columns.
5. **ZERO ENTITY DUPLICATION:** Do not recreate `Patient`, `Doctor`, `Course`, or `Student` tables.
6. **EVENT-AFTER-PERSISTENCE:** `DB COMMIT → DOMAIN EVENT → CONSUMER`.
7. **TENANT ISOLATION (GATE 0):** Enforce `tenant_id` on all queries/services.
8. **PRE-CODING ANALYSIS:** Output `ARCHITECTURE_GATE_RESULT.md` before coding.
9. **NO CROSS-INDUSTRY COUPLING:** Retail/Education/Healthcare OS must never import from each other. They must remain completely isolated.
10. **VERIFICATION:** Run `npm run healthcare:verify` before completion.
