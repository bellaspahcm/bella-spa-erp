# TypeScript diagnostics — 2026-09-07

Đây là inventory CHƯA ĐẦY ĐỦ từ compiler API với cấu hình root, không phải full tsc PASS. 251 diagnostics trong 47 file đã ghi nhận. Probe kiểm tra từng source file và tách các hotspot để tiếp tục thu thập; không sửa excludes của tsconfig.

## Phạm vi chưa có kết luận

- BusinessRollbackEngine.ts: hai static methods truy vấn bảng không có trong generated schema; timeout tái hiện 15 giây/method.
- FinancialReportingService.ts, NextBestActionEngine.ts, PartsInventoryIntegration.ts: chậm/treo trong probe; phần còn lại src/modules/bella-auto được tách khỏi probe tiếp tục, chưa có verdict.
- src/products/bella-automove/actions/invoice-actions.ts: chưa có verdict do probe không hoàn tất.
- src/products/bella-preschool/actions/student-actions.ts: hoàn tất sau 45.091 giây, diagnostics đã có trong danh sách. Probe đã dừng riêng tiến trình của phiên khi bắt đầu classroom-actions.ts; file này và phần source phía sau trong thứ tự compiler chưa có verdict.
- Scripts, tests và e2e vốn nằm ngoài root tsconfig, chưa typecheck trong đợt này.
- Các dòng sau là chẩn đoán thực tế, chưa đồng nghĩa đã phân loại root cause hoặc được phép đổi nghiệp vụ.

## Theo file

| File | Diagnostics |
|---|---:|
| [src/services/healthcare/healthcare-actions.ts](../../src/services/healthcare/healthcare-actions.ts) | 65 |
| [src/products/bella-preschool/actions/student-actions.ts](../../src/products/bella-preschool/actions/student-actions.ts) | 29 |
| [src/lib/workflow-engine/samples/booking-to-fulfillment.ts](../../src/lib/workflow-engine/samples/booking-to-fulfillment.ts) | 14 |
| [src/products/bella-automove/actions/repair-order-actions.ts](../../src/products/bella-automove/actions/repair-order-actions.ts) | 11 |
| [src/app/dashboard/services/hooks/useServicesPageState.ts](../../src/app/dashboard/services/hooks/useServicesPageState.ts) | 10 |
| [src/services/intelligence/recommendation/service-recommendation.ts](../../src/services/intelligence/recommendation/service-recommendation.ts) | 8 |
| [src/services/intelligence/recommendation/upsell-recommendation.ts](../../src/services/intelligence/recommendation/upsell-recommendation.ts) | 8 |
| [src/app/dashboard/healthcare/components/workspace-engine.ts](../../src/app/dashboard/healthcare/components/workspace-engine.ts) | 8 |
| [src/app/dashboard/customers/[id]/useCustomerDetailController.ts](../../src/app/dashboard/customers/[id]/useCustomerDetailController.ts) | 7 |
| [src/app/api/bella-auto/transactions/route.ts](../../src/app/api/bella-auto/transactions/route.ts) | 6 |
| [src/lib/workflow-engine/samples/payroll-approval.ts](../../src/lib/workflow-engine/samples/payroll-approval.ts) | 6 |
| [src/lib/workflow-engine/samples/inventory-reorder.ts](../../src/lib/workflow-engine/samples/inventory-reorder.ts) | 6 |
| [src/app/api/bella-auto/transactions/[id]/route.ts](../../src/app/api/bella-auto/transactions/[id]/route.ts) | 5 |
| [src/platform/business-truth/critique/critique-engine.ts](../../src/platform/business-truth/critique/critique-engine.ts) | 5 |
| [src/components/intelligence/BudgetStatusChart.tsx](../../src/components/intelligence/BudgetStatusChart.tsx) | 4 |
| [src/modules/bella-auto/services/LostAnalysisAIService.ts](../../src/modules/bella-auto/services/LostAnalysisAIService.ts) | 4 |
| [src/products/bella-automove/actions/appointment-actions.ts](../../src/products/bella-automove/actions/appointment-actions.ts) | 4 |
| [src/products/bella-hospital/services/hospital-clinical-alert.service.ts](../../src/products/bella-hospital/services/hospital-clinical-alert.service.ts) | 4 |
| [src/lib/bella-auto/engines/BusinessRuleEngine.ts](../../src/lib/bella-auto/engines/BusinessRuleEngine.ts) | 3 |
| [src/platform/bootstrap.ts](../../src/platform/bootstrap.ts) | 3 |
| [src/platform/business-truth/research/inference-engine.ts](../../src/platform/business-truth/research/inference-engine.ts) | 3 |
| [src/platform/business-truth/pipeline/intelligence-pipeline.ts](../../src/platform/business-truth/pipeline/intelligence-pipeline.ts) | 3 |
| [src/app/api/bella-auto/transactions/[id]/rollback/route.ts](../../src/app/api/bella-auto/transactions/[id]/rollback/route.ts) | 2 |
| [src/services/intelligence/marketing/queries.ts](../../src/services/intelligence/marketing/queries.ts) | 2 |
| [src/services/intelligence/recommendation/package-recommendation.ts](../../src/services/intelligence/recommendation/package-recommendation.ts) | 2 |
| [src/components/error-boundary/ErrorBoundary.tsx](../../src/components/error-boundary/ErrorBoundary.tsx) | 2 |
| [src/components/intelligence/ExpenseBreakdownChart.tsx](../../src/components/intelligence/ExpenseBreakdownChart.tsx) | 2 |
| [src/components/intelligence/RevenueBreakdownChart.tsx](../../src/components/intelligence/RevenueBreakdownChart.tsx) | 2 |
| [src/services/providers/compensation-provider.ts](../../src/services/providers/compensation-provider.ts) | 2 |
| [src/platform/f-and-b/repositories/order.repository.ts](../../src/platform/f-and-b/repositories/order.repository.ts) | 2 |
| [src/products/bella-automove/actions/vehicle-actions.ts](../../src/products/bella-automove/actions/vehicle-actions.ts) | 2 |
| [src/products/bella-dental/services/dental-chair.service.ts](../../src/products/bella-dental/services/dental-chair.service.ts) | 2 |
| [src/app/api/bella-auto/vehicles/available/route.ts](../../src/app/api/bella-auto/vehicles/available/route.ts) | 1 |
| [src/app/dashboard/customers/[id]/hooks/useKtvAvailability.ts](../../src/app/dashboard/customers/[id]/hooks/useKtvAvailability.ts) | 1 |
| [src/app/dashboard/healthcare/components/ClinicalContextPanel.tsx](../../src/app/dashboard/healthcare/components/ClinicalContextPanel.tsx) | 1 |
| [src/components/intelligence/customer/ChurnRiskChart.tsx](../../src/components/intelligence/customer/ChurnRiskChart.tsx) | 1 |
| [src/services/providers/base-salary-provider.ts](../../src/services/providers/base-salary-provider.ts) | 1 |
| [src/lib/business-process/procurement-process.ts](../../src/lib/business-process/procurement-process.ts) | 1 |
| [src/modules/bella-auto/services/NPSSurveyService.ts](../../src/modules/bella-auto/services/NPSSurveyService.ts) | 1 |
| [src/platform/business-truth/research/types.ts](../../src/platform/business-truth/research/types.ts) | 1 |
| [src/platform/business-truth/research/collectors/bella-collector.ts](../../src/platform/business-truth/research/collectors/bella-collector.ts) | 1 |
| [src/platform/business-truth/research/collectors/web-collector.ts](../../src/platform/business-truth/research/collectors/web-collector.ts) | 1 |
| [src/platform/business-truth/research/synthesizer.ts](../../src/platform/business-truth/research/synthesizer.ts) | 1 |
| [src/products/bella-education/services/course-catalog.service.ts](../../src/products/bella-education/services/course-catalog.service.ts) | 1 |
| [src/products/bella-education/services/enrollment.service.ts](../../src/products/bella-education/services/enrollment.service.ts) | 1 |
| [src/products/bella-education/services/attendance.service.ts](../../src/products/bella-education/services/attendance.service.ts) | 1 |
| [src/products/bella-education/services/assessment.service.ts](../../src/products/bella-education/services/assessment.service.ts) | 1 |

## Chẩn đoán nguyên văn

```text
src/app/api/bella-auto/transactions/route.ts(38,34): error TS2345: Argument of type 'string' is not assignable to parameter of type 'NonNullable<"pending" | "committed" | "rolled_back" | "failed">'.
src/app/api/bella-auto/transactions/route.ts(42,44): error TS2345: Argument of type 'string' is not assignable to parameter of type 'NonNullable<"vehicle_delivery" | "service_complete" | "trade_in_approval" | "loan_disbursement" | "deposit_payment" | "quotation_approval" | "test_drive_complete" | "warranty_claim_approval">'.
src/app/api/bella-auto/transactions/route.ts(75,26): error TS2339: Property 'rollback_reason' does not exist on type 'TransactionRow'.
src/app/api/bella-auto/transactions/route.ts(76,24): error TS2339: Property 'rolled_back_at' does not exist on type 'TransactionRow'.
src/app/api/bella-auto/transactions/route.ts(77,34): error TS2339: Property 'rolled_back_by_email' does not exist on type '{ created_by_email?: string | undefined; }'.
src/app/api/bella-auto/transactions/route.ts(78,21): error TS2339: Property 'steps' does not exist on type 'TransactionRow'.
src/app/api/bella-auto/transactions/[id]/route.ts(57,40): error TS2339: Property 'created_by_email' does not exist on type 'string | number | boolean | { [key: string]: Json | undefined; } | Json[]'.
src/app/api/bella-auto/transactions/[id]/route.ts(60,43): error TS2339: Property 'rolled_back_by_email' does not exist on type 'string | number | boolean | { [key: string]: Json | undefined; } | Json[]'.
src/app/api/bella-auto/transactions/[id]/route.ts(62,24): error TS2345: Argument of type '(step: { id: string; step_order: number; action_type: string; target_table: string; target_record_id?: string; before_snapshot?: unknown; after_snapshot?: unknown; status: string; created_at: string; }) => { ...; }' is not assignable to parameter of type '(value: { action: string; compensating_action: string | null; compensating_params: Json; created_at: string; entity_id: string; entity_type: string; error_message: string | null; executed_at: string | null; ... 8 more ...; transaction_id: string; }, index: number, array: { ...; }[]) => { ...; }'.
src/app/api/bella-auto/transactions/[id]/route.ts(71,26): error TS2339: Property 'executed_at' does not exist on type '{ id: string; step_order: number; action_type: string; target_table: string; target_record_id?: string | undefined; before_snapshot?: unknown; after_snapshot?: unknown; status: string; created_at: string; }'.
src/app/api/bella-auto/transactions/[id]/route.ts(72,28): error TS2339: Property 'error_message' does not exist on type '{ id: string; step_order: number; action_type: string; target_table: string; target_record_id?: string | undefined; before_snapshot?: unknown; after_snapshot?: unknown; status: string; created_at: string; }'.
src/app/api/bella-auto/transactions/[id]/rollback/route.ts(60,9): error TS2367: This comparison appears to be unintentional because the types '"pending" | "committed" | "failed"' and '"completed"' have no overlap.
src/app/api/bella-auto/transactions/[id]/rollback/route.ts(83,32): error TS2339: Property 'completedSteps' does not exist on type '{ success: boolean; error?: string | undefined; stepsRolledBack?: number | undefined; }'.
src/app/api/bella-auto/vehicles/available/route.ts(39,21): error TS2345: Argument of type '"available"' is not assignable to parameter of type 'NonNullable<"in_transit" | "warehouse" | "showroom" | "allocated" | "delivered" | "returned" | "scrapped">'.
src/services/intelligence/marketing/queries.ts(188,3): error TS2322: Type 'unknown' is not assignable to type 'CampaignAnalytics'.
src/services/intelligence/marketing/queries.ts(388,3): error TS2322: Type 'unknown' is not assignable to type 'ChannelPerformance[]'.
src/services/intelligence/recommendation/service-recommendation.ts(294,47): error TS2551: Property 'item_id' does not exist on type 'CustomerItemInteraction'. Did you mean 'itemId'?
src/services/intelligence/recommendation/service-recommendation.ts(296,31): error TS2551: Property 'item_id' does not exist on type 'CustomerItemInteraction'. Did you mean 'itemId'?
src/services/intelligence/recommendation/service-recommendation.ts(307,80): error TS2551: Property 'interaction_score' does not exist on type 'CustomerItemInteraction'. Did you mean 'interactionScore'?
src/services/intelligence/recommendation/service-recommendation.ts(692,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/service-recommendation.ts(693,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/service-recommendation.ts(694,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/service-recommendation.ts(697,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/service-recommendation.ts(699,7): error TS2322: Type 'string | null | undefined' is not assignable to type 'string'.
src/services/intelligence/recommendation/upsell-recommendation.ts(475,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/upsell-recommendation.ts(476,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/upsell-recommendation.ts(477,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/upsell-recommendation.ts(480,7): error TS2322: Type 'number | null | undefined' is not assignable to type 'number'.
src/services/intelligence/recommendation/upsell-recommendation.ts(482,7): error TS2322: Type 'string | null | undefined' is not assignable to type 'string'.
src/services/intelligence/recommendation/upsell-recommendation.ts(570,13): error TS18046: 'booking' is of type 'unknown'.
src/services/intelligence/recommendation/upsell-recommendation.ts(570,33): error TS18046: 'booking' is of type 'unknown'.
src/services/intelligence/recommendation/upsell-recommendation.ts(571,32): error TS18046: 'booking' is of type 'unknown'.
src/services/intelligence/recommendation/package-recommendation.ts(117,74): error TS2345: Argument of type '{ allowed_franchise_override: boolean | null; before_after_required: boolean; care_note_template: string | null; created_at: string | null; default_duration_minutes: number; default_resource_type: string | null; ... 25 more ...; updated_at: string | null; }' is not assignable to parameter of type 'PackageRow'.
src/services/intelligence/recommendation/package-recommendation.ts(636,3): error TS2322: Type 'Set<unknown>' is not assignable to type 'Set<string>'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(591,44): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(595,44): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(602,44): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(691,38): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(703,46): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(707,46): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/useCustomerDetailController.ts(863,44): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | number | null | undefined'.
src/app/dashboard/customers/[id]/hooks/useKtvAvailability.ts(98,20): error TS2345: Argument of type '(params: { date: string; time: string; duration?: number; excludeBookingId?: string; }) => Promise<void>' is not assignable to parameter of type '(...args: unknown[]) => void'.
src/services/healthcare/healthcare-actions.ts(328,35): error TS2339: Property 'full_name' does not exist on type 'SelectQueryError<"column 'full_name' does not exist on 'customers'.">'.
src/services/healthcare/healthcare-actions.ts(338,15): error TS2345: Argument of type '{ tenant_id: string; patient_party_id: string; care_journey_id: string; encounter_class: string; status: string; chief_complaint: string; notes: string; started_at: string; }' is not assignable to parameter of type 'RejectExcessProperties<{ arrived_at?: string | null | undefined; care_journey_id?: string | null | undefined; chief_complaint?: string | null | undefined; completed_at?: string | null | undefined; created_at?: string | undefined; ... 24 more ...; version?: number | undefined; }, { ...; }> | RejectExcessProperties<.....'.
src/services/healthcare/healthcare-actions.ts(396,7): error TS2353: Object literal may only specify known properties, and 'details' does not exist in type 'RejectExcessProperties<{ action: string; changed_by_id?: string | null | undefined; created_at?: string | undefined; id?: string | undefined; new_data?: Json | undefined; old_data?: Json | undefined; record_id: string; table_name: string; tenant_id: string; }, { ...; }> | RejectExcessProperties<...>[]'.
src/services/healthcare/healthcare-actions.ts(399,35): error TS2352: Conversion of type '{ arrived_at: string | null; care_journey_id: string | null; chief_complaint: string | null; completed_at: string | null; created_at: string; created_by: string | null; deleted_at: string | null; ... 22 more ...; version: number; }' to type 'Encounter' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/services/healthcare/healthcare-actions.ts(584,15): error TS2345: Argument of type 'Record<string, unknown>' is not assignable to parameter of type 'RejectExcessProperties<{ arrived_at?: string | null | undefined; care_journey_id?: string | null | undefined; chief_complaint?: string | null | undefined; completed_at?: string | null | undefined; created_at?: string | undefined; ... 24 more ...; version?: number | undefined; }, Record<...>>'.
src/services/healthcare/healthcare-actions.ts(670,7): error TS2353: Object literal may only specify known properties, and 'details' does not exist in type 'RejectExcessProperties<{ action: string; changed_by_id?: string | null | undefined; created_at?: string | undefined; id?: string | undefined; new_data?: Json | undefined; old_data?: Json | undefined; record_id: string; table_name: string; tenant_id: string; }, { ...; }> | RejectExcessProperties<...>[]'.
src/services/healthcare/healthcare-actions.ts(718,20): error TS2339: Property 'name_mother' does not exist on type '{}'.
src/services/healthcare/healthcare-actions.ts(719,22): error TS2339: Property 'gender_baby' does not exist on type '{}'.
src/services/healthcare/healthcare-actions.ts(720,19): error TS2339: Property 'dob_baby' does not exist on type '{}'.
src/services/healthcare/healthcare-actions.ts(724,21): error TS2339: Property 'phone' does not exist on type '{}'.
src/services/healthcare/healthcare-actions.ts(925,11): error TS2322: Type '{ id: string; patientName: string; doctorName: string; status: "in_progress" | "planned" | "finished" | "arrived"; chiefComplaint: string; queueNumber: number; scheduledAt: string; arrivedAt: string; ... 8 more ...; plan: any; }[]' is not assignable to type 'EncounterViewModel[]'.
src/services/healthcare/healthcare-actions.ts(967,27): error TS2367: This comparison appears to be unintentional because the types '"in_progress" | "planned" | "finished" | "arrived"' and '"completed"' have no overlap.
src/services/healthcare/healthcare-actions.ts(992,48): error TS2339: Property 'subjective_notes' does not exist on type '{ arrived_at: string | null; care_journey_id: string | null; chief_complaint: string | null; completed_at: string | null; created_at: string; created_by: string | null; deleted_at: string | null; ... 22 more ...; version: number; }'.
src/services/healthcare/healthcare-actions.ts(993,46): error TS2339: Property 'objective_notes' does not exist on type '{ arrived_at: string | null; care_journey_id: string | null; chief_complaint: string | null; completed_at: string | null; created_at: string; created_by: string | null; deleted_at: string | null; ... 22 more ...; version: number; }'.
src/services/healthcare/healthcare-actions.ts(994,48): error TS2339: Property 'assessment_notes' does not exist on type '{ arrived_at: string | null; care_journey_id: string | null; chief_complaint: string | null; completed_at: string | null; created_at: string; created_by: string | null; deleted_at: string | null; ... 22 more ...; version: number; }'.
src/services/healthcare/healthcare-actions.ts(995,36): error TS2339: Property 'plan_notes' does not exist on type '{ arrived_at: string | null; care_journey_id: string | null; chief_complaint: string | null; completed_at: string | null; created_at: string; created_by: string | null; deleted_at: string | null; ... 22 more ...; version: number; }'.
src/services/healthcare/healthcare-actions.ts(1085,40): error TS2353: Object literal may only specify known properties, and 'name' does not exist in type 'RejectExcessProperties<{ ai_summary?: string | null | undefined; completed_at?: string | null | undefined; created_at?: string | undefined; deleted_at?: string | null | undefined; id?: string | undefined; ... 7 more ...; vertical: string; }, { ...; }> | RejectExcessProperties<...>[]'.
src/services/healthcare/healthcare-actions.ts(1209,19): error TS2345: Argument of type '{ tenant_id: string; care_journey_id: string; patient_party_id: string; doctor_party_id: string | undefined; encounter_class: string; status: string; chief_complaint: string; notes: string; queue_number: number; scheduled_at: string; }' is not assignable to parameter of type 'RejectExcessProperties<{ arrived_at?: string | null | undefined; care_journey_id?: string | null | undefined; chief_complaint?: string | null | undefined; completed_at?: string | null | undefined; created_at?: string | undefined; ... 24 more ...; version?: number | undefined; }, { ...; }> | RejectExcessProperties<.....'.
src/services/healthcare/healthcare-actions.ts(1244,13): error TS2353: Object literal may only specify known properties, and 'patient_party_id' does not exist in type 'RejectExcessProperties<{ called_at?: string | null | undefined; created_at?: string | undefined; current_station?: string | null | undefined; encounter_id: string; id?: string | undefined; patient_name: string; queue_type?: string | ... 1 more ... | undefined; status?: string | ... 1 more ... | undefined; tenant_id:...'.
src/services/healthcare/healthcare-actions.ts(1269,33): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(1277,11): error TS2322: Type 'string | null' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(1289,11): error TS2322: Type 'string | null' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(1320,33): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(1328,11): error TS2322: Type 'string | null' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(1438,15): error TS2345: Argument of type '{ tenant_id: string; care_journey_id: string; patient_party_id: string; doctor_party_id: string | null; encounter_class: string; status: string; chief_complaint: string; }' is not assignable to parameter of type 'RejectExcessProperties<{ arrived_at?: string | null | undefined; care_journey_id?: string | null | undefined; chief_complaint?: string | null | undefined; completed_at?: string | null | undefined; created_at?: string | undefined; ... 24 more ...; version?: number | undefined; }, { ...; }> | RejectExcessProperties<.....'.
src/services/healthcare/healthcare-actions.ts(1708,99): error TS2339: Property 'patient_name' does not exist on type '{ clinical_order_id: string; created_at: string; doctor_notified: boolean | null; doctor_notified_time: string | null; encounter_id: string; id: string; is_abnormal: boolean | null; ... 10 more ...; verified_by: string | null; }'.
src/services/healthcare/healthcare-actions.ts(1775,31): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(1785,11): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(1800,17): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(1819,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(1837,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(1892,19): error TS2353: Object literal may only specify known properties, and 'status' does not exist in type 'RejectExcessProperties<{ approved_at?: string | null | undefined; approved_by?: string | null | undefined; cds_check_id?: string | null | undefined; cds_check_status?: string | null | undefined; created_at?: string | undefined; ... 16 more ...; version?: number | undefined; }, { ...; }>'.
src/services/healthcare/healthcare-actions.ts(1943,30): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(1976,24): error TS2339: Property 'series_count' does not exist on type '{ body_site: string; clinical_order_id: string | null; created_at: string; dcm_study_uid: string | null; doctor_notified: boolean | null; doctor_notified_time: string | null; encounter_id: string | null; ... 9 more ...; viewer_link: string | null; }'.
src/services/healthcare/healthcare-actions.ts(1977,23): error TS2339: Property 'image_count' does not exist on type '{ body_site: string; clinical_order_id: string | null; created_at: string; dcm_study_uid: string | null; doctor_notified: boolean | null; doctor_notified_time: string | null; encounter_id: string | null; ... 9 more ...; viewer_link: string | null; }'.
src/services/healthcare/healthcare-actions.ts(1978,24): error TS2339: Property 'storage_size' does not exist on type '{ body_site: string; clinical_order_id: string | null; created_at: string; dcm_study_uid: string | null; doctor_notified: boolean | null; doctor_notified_time: string | null; encounter_id: string | null; ... 9 more ...; viewer_link: string | null; }'.
src/services/healthcare/healthcare-actions.ts(2144,31): error TS2322: Type '({ id: string; ticketNumber: string; patientName: string; modality: string; bodySite: string; dcmStudyUid: string; viewerLink: string; status: string; radiologistReport: undefined; priority: "STAT"; ... 7 more ...; doctorNotifiedTime: undefined; } | { ...; } | { ...; } | { ...; } | { ...; })[]' is not assignable to type 'ImagingOrderViewModel[]'.
src/services/healthcare/healthcare-actions.ts(2191,31): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(2201,11): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(2216,17): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/services/healthcare/healthcare-actions.ts(2235,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(2648,7): error TS2322: Type '{ drugCode: string; drugName: any; qty: number; dosageInstruction: string; }' is not assignable to type 'MedicationOrderDetails | LabOrderDetails | ImagingOrderDetails | GenericOrderDetails'.
src/services/healthcare/healthcare-actions.ts(2780,51): error TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder<{ PostgrestVersion: "14.5"; }, { Tables: { _prisma_migrations: { Row: { applied_steps_count: number; checksum: string; finished_at: string | null; id: string; logs: string | null; migration_name: string; rolled_back_at: string | null; started_at: string; }; Insert: { ...; }; Update: { ...; }; ...'. Did you mean 'match'?
src/services/healthcare/healthcare-actions.ts(2820,31): error TS2322: Type '{ id: string; encounterId: string; patientName: string; bhytCode: string; benefitRate: number; totalAmount: number; bhytCovered: number; patientPay: number; status: string; itemsCount: number; }[]' is not assignable to type 'HealthcareInvoiceViewModel[]'.
src/services/healthcare/healthcare-actions.ts(2916,51): error TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder<{ PostgrestVersion: "14.5"; }, { Tables: { _prisma_migrations: { Row: { applied_steps_count: number; checksum: string; finished_at: string | null; id: string; logs: string | null; migration_name: string; rolled_back_at: string | null; started_at: string; }; Insert: { ...; }; Update: { ...; }; ...'. Did you mean 'match'?
src/services/healthcare/healthcare-actions.ts(2939,35): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/services/healthcare/healthcare-actions.ts(2940,13): error TS2769: No overload matches this call.
src/services/healthcare/healthcare-actions.ts(2942,11): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
src/services/healthcare/healthcare-actions.ts(2943,11): error TS2345: Argument of type '"tenant_id"' is not assignable to parameter of type 'never'.
src/services/healthcare/healthcare-actions.ts(2970,29): error TS2339: Property 'chief_complaint' does not exist on type 'NonNullable<ResultOne>'.
src/services/healthcare/healthcare-actions.ts(2971,24): error TS2339: Property 'subjective' does not exist on type 'NonNullable<ResultOne>'.
src/services/healthcare/healthcare-actions.ts(2972,23): error TS2339: Property 'objective' does not exist on type 'NonNullable<ResultOne>'.
src/services/healthcare/healthcare-actions.ts(2973,24): error TS2339: Property 'assessment' does not exist on type 'NonNullable<ResultOne>'.
src/services/healthcare/healthcare-actions.ts(2974,18): error TS2339: Property 'plan' does not exist on type 'NonNullable<ResultOne>'.
src/services/healthcare/healthcare-actions.ts(3086,57): error TS18047: 'baseSalary' is possibly 'null'.
src/services/healthcare/healthcare-actions.ts(3086,70): error TS18047: 'commission' is possibly 'null'.
src/services/healthcare/healthcare-actions.ts(3094,9): error TS2322: Type 'number | null' is not assignable to type 'number'.
src/services/healthcare/healthcare-actions.ts(3095,9): error TS2322: Type 'number | null' is not assignable to type 'number'.
src/services/healthcare/healthcare-actions.ts(3097,9): error TS2322: Type 'number | null' is not assignable to type 'number'.
src/services/healthcare/healthcare-actions.ts(3098,9): error TS2322: Type 'string | null' is not assignable to type 'string'.
src/services/healthcare/healthcare-actions.ts(3330,19): error TS2353: Object literal may only specify known properties, and 'status' does not exist in type 'RejectExcessProperties<{ approved_at?: string | null | undefined; approved_by?: string | null | undefined; cds_check_id?: string | null | undefined; cds_check_status?: string | null | undefined; created_at?: string | undefined; ... 16 more ...; version?: number | undefined; }, { ...; }>'.
src/services/healthcare/healthcare-actions.ts(3375,19): error TS2353: Object literal may only specify known properties, and 'status' does not exist in type 'RejectExcessProperties<{ approved_at?: string | null | undefined; approved_by?: string | null | undefined; cds_check_id?: string | null | undefined; cds_check_status?: string | null | undefined; created_at?: string | undefined; ... 16 more ...; version?: number | undefined; }, { ...; }>'.
src/services/healthcare/healthcare-actions.ts(3523,20): error TS7053: Element implicitly has an 'any' type because expression of type '0' can't be used to index type 'string | number | true | { [key: string]: Json | undefined; } | Json[]'.
src/services/healthcare/healthcare-actions.ts(3541,34): error TS2339: Property 'display_name' does not exist on type 'SelectQueryError<"Could not embed because more than one relationship was found for 'party_parties' and 'hc_prescriptions' you need to hint the column with party_parties!<columnName> ?">'.
src/services/healthcare/healthcare-actions.ts(3544,32): error TS2339: Property 'display_name' does not exist on type 'SelectQueryError<"Could not embed because more than one relationship was found for 'party_parties' and 'hc_prescriptions' you need to hint the column with party_parties!<columnName> ?">'.
src/app/dashboard/healthcare/components/ClinicalContextPanel.tsx(20,30): error TS2339: Property 'toothData' does not exist on type 'PatientContext'.
src/app/dashboard/healthcare/components/workspace-engine.ts(12,3): error TS2322: Type '({ context }: { context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(13,3): error TS2322: Type '({ context }: { context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(14,3): error TS2322: Type '({ context }: { context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(15,3): error TS2322: Type '({ context }: { context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(16,3): error TS2322: Type '({ context }: { readonly context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(17,3): error TS2322: Type '({ context }: { context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(18,3): error TS2322: Type '({ context }: { context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/healthcare/components/workspace-engine.ts(19,3): error TS2322: Type '({ context }: { readonly context: ClinicalContextType; }) => Element' is not assignable to type 'ComponentType<Record<string, unknown>>'.
src/app/dashboard/services/hooks/useServicesPageState.ts(56,7): error TS2739: Type '{ babycare: false; beauty_spa: false; student_training: false; industrial_cleaning: false; real_estate: false; }' is missing the following properties from type 'TenantEnabledModules': bella_auto, bella_healthcare
src/app/dashboard/services/hooks/useServicesPageState.ts(348,7): error TS2322: Type '"beauty_spa" | "bella_auto" | "babycare" | "industrial_cleaning" | "real_estate" | "bella_healthcare"' is not assignable to type 'ServiceModuleKey'.
src/app/dashboard/services/hooks/useServicesPageState.ts(393,15): error TS2345: Argument of type '(current: ServiceFormState) => { moduleKey: "beauty_spa" | "bella_auto" | "babycare" | "industrial_cleaning" | "real_estate" | "bella_healthcare"; name: string; ... 19 more ...; risBodySite: string; }' is not assignable to parameter of type 'SetStateAction<ServiceFormState>'.
src/app/dashboard/services/hooks/useServicesPageState.ts(491,47): error TS2339: Property 'lisCode' does not exist on type '{}'.
src/app/dashboard/services/hooks/useServicesPageState.ts(492,53): error TS2339: Property 'lisSampleType' does not exist on type '{}'.
src/app/dashboard/services/hooks/useServicesPageState.ts(493,52): error TS2339: Property 'lisTubeColor' does not exist on type '{}'.
src/app/dashboard/services/hooks/useServicesPageState.ts(494,47): error TS2339: Property 'risCode' does not exist on type '{}'.
src/app/dashboard/services/hooks/useServicesPageState.ts(495,51): error TS2339: Property 'risModality' does not exist on type '{}'.
src/app/dashboard/services/hooks/useServicesPageState.ts(496,51): error TS2339: Property 'risBodySite' does not exist on type '{}'.
src/app/dashboard/services/hooks/useServicesPageState.ts(711,9): error TS2353: Object literal may only specify known properties, and 'metadata' does not exist in type 'PackageActionInput'.
src/components/error-boundary/ErrorBoundary.tsx(49,42): error TS2571: Object is of type 'unknown'.
src/components/error-boundary/ErrorBoundary.tsx(50,7): error TS2571: Object is of type 'unknown'.
src/components/intelligence/BudgetStatusChart.tsx(94,11): error TS2769: No overload matches this call.
src/components/intelligence/BudgetStatusChart.tsx(104,11): error TS2322: Type '(value: ValueType | undefined, name: NameType | undefined, props: Record<string, unknown>) => [string, NameType | undefined]' is not assignable to type 'Formatter<ValueType, NameType> & ((value: ValueType, name: NameType, item: TooltipPayloadEntry, index: number, payload: TooltipPayload) => ReactNode | [...])'.
src/components/intelligence/BudgetStatusChart.tsx(105,56): error TS18046: 'props.payload' is of type 'unknown'.
src/components/intelligence/BudgetStatusChart.tsx(109,29): error TS18046: 'props.payload' is of type 'unknown'.
src/components/intelligence/ExpenseBreakdownChart.tsx(102,11): error TS2769: No overload matches this call.
src/components/intelligence/ExpenseBreakdownChart.tsx(127,11): error TS2322: Type '(value: any, entry: Record<string, unknown>) => string' is not assignable to type 'Formatter'.
src/components/intelligence/RevenueBreakdownChart.tsx(103,11): error TS2769: No overload matches this call.
src/components/intelligence/RevenueBreakdownChart.tsx(128,11): error TS2322: Type '(value: any, entry: Record<string, unknown>) => string' is not assignable to type 'Formatter'.
src/components/intelligence/customer/ChurnRiskChart.tsx(104,27): error TS2322: Type '(props: Record<string, unknown>) => JSX.Element' is not assignable to type 'ContentType | undefined'.
src/lib/bella-auto/engines/BusinessRuleEngine.ts(139,15): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
src/lib/bella-auto/engines/BusinessRuleEngine.ts(261,9): error TS2769: No overload matches this call.
src/lib/bella-auto/engines/BusinessRuleEngine.ts(311,51): error TS2345: Argument of type '(l: Record<string, unknown>) => boolean' is not assignable to parameter of type '(value: ApprovalLevel, index: number, array: ApprovalLevel[]) => unknown'.
src/services/providers/base-salary-provider.ts(89,9): error TS2322: Type '{} | null' is not assignable to type 'number | undefined'.
src/services/providers/compensation-provider.ts(139,9): error TS2322: Type '{} | null' is not assignable to type 'number | undefined'.
src/services/providers/compensation-provider.ts(237,7): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number | undefined'.
src/lib/business-process/procurement-process.ts(65,25): error TS2345: Argument of type '{}' is not assignable to parameter of type 'ValidationResult | ApprovalRoutingResult | EscalationResult'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(124,26): error TS2339: Property 'outcome' does not exist on type '{}'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(124,59): error TS2339: Property 'approved' does not exist on type '{}'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(138,25): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(139,26): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(166,26): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(167,26): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(191,21): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(194,30): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(195,32): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(210,51): error TS2571: Object is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(229,24): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(247,17): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(250,26): error TS18046: 'booking' is of type 'unknown'.
src/lib/workflow-engine/samples/booking-to-fulfillment.ts(251,61): error TS2339: Property 'explanation' does not exist on type '{}'.
src/lib/workflow-engine/samples/payroll-approval.ts(156,25): error TS2339: Property 'bonusAmount' does not exist on type '{}'.
src/lib/workflow-engine/samples/payroll-approval.ts(157,32): error TS2339: Property 'amount' does not exist on type '{}'.
src/lib/workflow-engine/samples/payroll-approval.ts(158,31): error TS2339: Property 'deductionAmount' does not exist on type '{}'.
src/lib/workflow-engine/samples/payroll-approval.ts(164,36): error TS2339: Property 'bonusAmount' does not exist on type '{}'.
src/lib/workflow-engine/samples/payroll-approval.ts(165,45): error TS2339: Property 'amount' does not exist on type '{}'.
src/lib/workflow-engine/samples/payroll-approval.ts(166,44): error TS2339: Property 'deductionAmount' does not exist on type '{}'.
src/lib/workflow-engine/samples/inventory-reorder.ts(142,28): error TS2339: Property 'outcome' does not exist on type '{}'.
src/lib/workflow-engine/samples/inventory-reorder.ts(142,63): error TS2339: Property 'reorder' does not exist on type '{}'.
src/lib/workflow-engine/samples/inventory-reorder.ts(157,23): error TS18046: 'decision' is of type 'unknown'.
src/lib/workflow-engine/samples/inventory-reorder.ts(163,28): error TS18046: 'decision' is of type 'unknown'.
src/lib/workflow-engine/samples/inventory-reorder.ts(229,21): error TS18046: 'decision' is of type 'unknown'.
src/lib/workflow-engine/samples/inventory-reorder.ts(247,21): error TS18046: 'decision' is of type 'unknown'.
src/modules/bella-auto/services/LostAnalysisAIService.ts(103,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/modules/bella-auto/services/LostAnalysisAIService.ts(104,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/modules/bella-auto/services/LostAnalysisAIService.ts(105,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/modules/bella-auto/services/LostAnalysisAIService.ts(149,29): error TS2352: Conversion of type 'AIAnalysisResult' to type 'Json | undefined' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/modules/bella-auto/services/NPSSurveyService.ts(293,29): error TS2339: Property 'assigned_to' does not exist on type 'SelectQueryError<"column 'assigned_to' does not exist on 'auto_customer_journeys'.">'.
src/platform/bootstrap.ts(12,10): error TS2305: Module '"./education"' has no exported member 'EducationEngineService'.
src/platform/bootstrap.ts(12,34): error TS2305: Module '"./education"' has no exported member 'registerEducationEngine'.
src/platform/bootstrap.ts(12,59): error TS2305: Module '"./education"' has no exported member 'SupabaseEducationRepository'.
src/platform/business-truth/critique/critique-engine.ts(193,33): error TS2339: Property 'description' does not exist on type 'Conflict'.
src/platform/business-truth/critique/critique-engine.ts(203,60): error TS2339: Property 'description' does not exist on type 'Conflict'.
src/platform/business-truth/critique/critique-engine.ts(392,13): error TS2339: Property 'type' does not exist on type 'BusinessTruth'.
src/platform/business-truth/critique/critique-engine.ts(393,14): error TS2339: Property 'type' does not exist on type 'BusinessTruth'.
src/platform/business-truth/critique/critique-engine.ts(447,21): error TS2339: Property 'type' does not exist on type 'BusinessTruth'.
src/platform/business-truth/research/types.ts(9,30): error TS2305: Module '"../types/business-truth"' has no exported member 'Evidence'.
src/platform/business-truth/research/collectors/bella-collector.ts(9,15): error TS2305: Module '"../../types/business-truth"' has no exported member 'Evidence'.
src/platform/business-truth/research/collectors/web-collector.ts(10,15): error TS2305: Module '"../../types/business-truth"' has no exported member 'Evidence'.
src/platform/business-truth/research/synthesizer.ts(10,15): error TS2305: Module '"../types/business-truth"' has no exported member 'Evidence'.
src/platform/business-truth/research/inference-engine.ts(11,30): error TS2305: Module '"../types/business-truth"' has no exported member 'Evidence'.
src/platform/business-truth/research/inference-engine.ts(71,9): error TS2353: Object literal may only specify known properties, and 'attributes' does not exist in type 'BusinessTruthContent'.
src/platform/business-truth/research/inference-engine.ts(173,9): error TS2353: Object literal may only specify known properties, and 'steps' does not exist in type 'BusinessTruthContent'.
src/platform/business-truth/pipeline/intelligence-pipeline.ts(107,9): error TS2322: Type '{ authorized: boolean; authority: string | null; reason: string; timestamp: Date; approvedTruths?: BusinessTruth[] | undefined; }' is not assignable to type 'AuthorizationDecision'.
src/platform/business-truth/pipeline/intelligence-pipeline.ts(208,13): error TS2353: Object literal may only specify known properties, and 'timestamp' does not exist in type '{ intent: ResearchIntent; startedAt: Date; completedAt: Date; sourcesConsulted: number; synthesisApproach: string; }'.
src/platform/business-truth/pipeline/intelligence-pipeline.ts(212,9): error TS2322: Type '{ authorized: boolean; authority: string | null; reason: string; timestamp: Date; approvedTruths?: BusinessTruth[] | undefined; }' is not assignable to type 'AuthorizationDecision'.
src/platform/f-and-b/repositories/order.repository.ts(8,28): error TS2307: Cannot find module '@nestjs/common' or its corresponding type declarations.
src/platform/f-and-b/repositories/order.repository.ts(9,33): error TS2307: Cannot find module '../../../core/database/database.service' or its corresponding type declarations.
src/products/bella-automove/actions/vehicle-actions.ts(165,9): error TS2322: Type '"in_service"' is not assignable to type '"delivered" | "in_transit" | "warehouse" | "showroom" | "allocated" | "returned" | "scrapped" | undefined'.
src/products/bella-automove/actions/vehicle-actions.ts(220,15): error TS2345: Argument of type '{ updated_at: string; make?: string; model?: string; year?: number; color?: string; license_plate?: string; mileage?: number; customer_id?: string; }' is not assignable to parameter of type 'RejectExcessProperties<{ actual_arrival_date?: string | null | undefined; allocated_at?: string | null | undefined; allocated_by_user_id?: string | null | undefined; allocated_to_contract_id?: string | null | undefined; ... 20 more ...; vin?: string | undefined; }, { ...; }>'.
src/products/bella-automove/actions/appointment-actions.ts(60,35): error TS2352: Conversion of type '{ appointment_date: string; appointment_number: string; appointment_time: string; assigned_bay: string | null; assigned_technician_id: string | null; assigned_technicians: Json; ... 36 more ...; vehicle: { ...; }; }[]' to type 'AppointmentDetail[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/products/bella-automove/actions/appointment-actions.ts(101,35): error TS2352: Conversion of type '{ appointment_date: string; appointment_number: string; appointment_time: string; assigned_bay: string | null; assigned_technician_id: string | null; assigned_technicians: Json; ... 36 more ...; vehicle: { ...; }; }' to type 'AppointmentDetail' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/products/bella-automove/actions/appointment-actions.ts(172,15): error TS2345: Argument of type '{ tenant_id: string; appointment_number: string; vehicle_id: string; customer_id: string; appointment_date: string; service_type: string; notes: string | undefined; status: string; }' is not assignable to parameter of type 'RejectExcessProperties<{ appointment_date: string; appointment_number: string; appointment_time: string; assigned_bay?: string | null | undefined; assigned_technician_id?: string | null | undefined; ... 36 more ...; work_started_at?: string | ... 1 more ... | undefined; }, { ...; }> | RejectExcessProperties<...>[]'.
src/products/bella-automove/actions/appointment-actions.ts(241,15): error TS2345: Argument of type 'Record<string, any>' is not assignable to parameter of type 'RejectExcessProperties<{ appointment_date?: string | undefined; appointment_number?: string | undefined; appointment_time?: string | undefined; assigned_bay?: string | null | undefined; assigned_technician_id?: string | ... 1 more ... | undefined; ... 36 more ...; work_started_at?: string | ... 1 more ... | undefine...'.
src/products/bella-automove/actions/repair-order-actions.ts(59,11): error TS2322: Type '{ totals: { labor_total: number; parts_total: number; subtotal: number; tax: number; total: number; }; actual_hours: number | null; actual_labor_cost: number | null; actual_parts_cost: number | null; ... 54 more ...; appointment: { ...; } | null; }[]' is not assignable to type 'RepairOrderDetail[]'.
src/products/bella-automove/actions/repair-order-actions.ts(63,67): error TS2339: Property 'total_price' does not exist on type '{ created_at: string | null; description: string | null; discount_amount: number | null; discount_percentage: number | null; hourly_rate: number | null; id: string; inventory_item_id: string | null; ... 15 more ...; updated_at: string | null; }'.
src/products/bella-automove/actions/repair-order-actions.ts(67,67): error TS2339: Property 'total_price' does not exist on type '{ created_at: string | null; description: string | null; discount_amount: number | null; discount_percentage: number | null; hourly_rate: number | null; id: string; inventory_item_id: string | null; ... 15 more ...; updated_at: string | null; }'.
src/products/bella-automove/actions/repair-order-actions.ts(70,29): error TS2339: Property 'tax_rate' does not exist on type '{ actual_hours: number | null; actual_labor_cost: number | null; actual_parts_cost: number | null; actual_total: number | null; additional_technicians: Json; appointment_id: string | null; ... 51 more ...; appointment: { ...; } | null; }'.
src/products/bella-automove/actions/repair-order-actions.ts(133,65): error TS2339: Property 'total_price' does not exist on type '{ created_at: string | null; description: string | null; discount_amount: number | null; discount_percentage: number | null; hourly_rate: number | null; id: string; inventory_item_id: string | null; ... 15 more ...; updated_at: string | null; }'.
src/products/bella-automove/actions/repair-order-actions.ts(137,65): error TS2339: Property 'total_price' does not exist on type '{ created_at: string | null; description: string | null; discount_amount: number | null; discount_percentage: number | null; hourly_rate: number | null; id: string; inventory_item_id: string | null; ... 15 more ...; updated_at: string | null; }'.
src/products/bella-automove/actions/repair-order-actions.ts(140,27): error TS2339: Property 'tax_rate' does not exist on type '{ actual_hours: number | null; actual_labor_cost: number | null; actual_parts_cost: number | null; actual_total: number | null; additional_technicians: Json; appointment_id: string | null; ... 51 more ...; appointment: { ...; } | null; }'.
src/products/bella-automove/actions/repair-order-actions.ts(144,11): error TS2322: Type '{ totals: { labor_total: number; parts_total: number; subtotal: number; tax: number; total: number; }; actual_hours: number | null; actual_labor_cost: number | null; actual_parts_cost: number | null; ... 54 more ...; appointment: { ...; } | null; }' is not assignable to type 'RepairOrderDetail'.
src/products/bella-automove/actions/repair-order-actions.ts(224,9): error TS2353: Object literal may only specify known properties, and 'description' does not exist in type 'RejectExcessProperties<{ actual_hours?: number | null | undefined; actual_labor_cost?: number | null | undefined; actual_parts_cost?: number | null | undefined; actual_total?: number | null | undefined; ... 50 more ...; work_started_at?: string | ... 1 more ... | undefined; }, { ...; }> | RejectExcessProperties<...>[]'.
src/products/bella-automove/actions/repair-order-actions.ts(296,9): error TS2353: Object literal may only specify known properties, and 'total_price' does not exist in type 'RejectExcessProperties<{ created_at?: string | null | undefined; description?: string | null | undefined; discount_amount?: number | null | undefined; discount_percentage?: number | null | undefined; ... 18 more ...; updated_at?: string | ... 1 more ... | undefined; }, { ...; }> | RejectExcessProperties<...>[]'.
src/products/bella-automove/actions/repair-order-actions.ts(353,15): error TS2345: Argument of type 'Record<string, any>' is not assignable to parameter of type 'RejectExcessProperties<{ actual_hours?: number | null | undefined; actual_labor_cost?: number | null | undefined; actual_parts_cost?: number | null | undefined; actual_total?: number | null | undefined; ... 50 more ...; work_started_at?: string | ... 1 more ... | undefined; }, Record<...>>'.
src/products/bella-dental/services/dental-chair.service.ts(15,62): error TS2307: Cannot find module '../../../platform/healthcare/contracts/audit-compliance.contract' or its corresponding type declarations.
src/products/bella-dental/services/dental-chair.service.ts(16,10): error TS2305: Module '"../../../platform/healthcare/contracts/cds-engine.contract"' has no exported member 'ICdsContract'.
src/products/bella-education/services/course-catalog.service.ts(10,62): error TS2307: Cannot find module '../../../platform/education/contracts/course.contract' or its corresponding type declarations.
src/products/bella-education/services/enrollment.service.ts(11,70): error TS2307: Cannot find module '../../../platform/education/contracts/enrollment.contract' or its corresponding type declarations.
src/products/bella-education/services/attendance.service.ts(10,70): error TS2307: Cannot find module '../../../platform/education/contracts/attendance.contract' or its corresponding type declarations.
src/products/bella-education/services/assessment.service.ts(10,70): error TS2307: Cannot find module '../../../platform/education/contracts/assessment.contract' or its corresponding type declarations.
src/products/bella-hospital/services/hospital-clinical-alert.service.ts(13,10): error TS2305: Module '"../../../platform/healthcare/contracts/cds-engine.contract"' has no exported member 'ICdsContract'.
src/products/bella-hospital/services/hospital-clinical-alert.service.ts(13,24): error TS2305: Module '"../../../platform/healthcare/contracts/cds-engine.contract"' has no exported member 'OrderSafetyCheckInputDTO'.
src/products/bella-hospital/services/hospital-clinical-alert.service.ts(13,50): error TS2305: Module '"../../../platform/healthcare/contracts/cds-engine.contract"' has no exported member 'SafetyEvaluationResultDTO'.
src/products/bella-hospital/services/hospital-clinical-alert.service.ts(60,78): error TS7006: Parameter 'c' implicitly has an 'any' type.
src/products/bella-preschool/actions/student-actions.ts(25,45): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/products/bella-preschool/actions/student-actions.ts(26,13): error TS2769: No overload matches this call.
src/products/bella-preschool/actions/student-actions.ts(49,11): error TS2345: Argument of type '"tenant_id"' is not assignable to parameter of type 'never'.
src/products/bella-preschool/actions/student-actions.ts(93,44): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/products/bella-preschool/actions/student-actions.ts(94,13): error TS2769: No overload matches this call.
src/products/bella-preschool/actions/student-actions.ts(121,11): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
src/products/bella-preschool/actions/student-actions.ts(122,11): error TS2345: Argument of type '"tenant_id"' is not assignable to parameter of type 'never'.
src/products/bella-preschool/actions/student-actions.ts(135,39): error TS2339: Property 'enrollments' does not exist on type 'NonNullable<ResultOne>'.
src/products/bella-preschool/actions/student-actions.ts(139,11): error TS2740: Type '{ current_classroom: any; guardians: any; }' is missing the following properties from type 'StudentDetail': id, tenant_id, student_code, first_name, and 10 more.
src/products/bella-preschool/actions/student-actions.ts(142,26): error TS2339: Property 'guardians' does not exist on type 'NonNullable<ResultOne>'.
src/products/bella-preschool/actions/student-actions.ts(188,58): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/products/bella-preschool/actions/student-actions.ts(189,13): error TS2769: No overload matches this call.
src/products/bella-preschool/actions/student-actions.ts(191,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(192,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(193,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(194,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(195,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(196,9): error TS2322: Type '"male" | "female" | "other" | null' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(197,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(198,9): error TS2322: Type 'string' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(199,9): error TS2322: Type 'string | null' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(200,9): error TS2322: Type 'string | null' is not assignable to type 'never'.
src/products/bella-preschool/actions/student-actions.ts(222,15): error TS2769: No overload matches this call.
src/products/bella-preschool/actions/student-actions.ts(223,17): error TS2345: Argument of type '{ tenant_id: string | null; student_id: any; guardian_customer_id: string; relationship_type: "other" | "parent" | "grandparent" | "guardian"; is_primary_contact: boolean; is_authorized_pickup: boolean; is_emergency_contact: boolean; }[]' is not assignable to parameter of type 'RejectExcessProperties<{ applied_steps_count?: number | undefined; checksum: string; finished_at?: string | null | undefined; id: string; logs?: string | null | undefined; migration_name: string; rolled_back_at?: string | ... 1 more ... | undefined; started_at?: string | undefined; } | ... 365 more ... | { ...; }, {...'.
src/products/bella-preschool/actions/student-actions.ts(278,44): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/products/bella-preschool/actions/student-actions.ts(279,13): error TS2769: No overload matches this call.
src/products/bella-preschool/actions/student-actions.ts(280,15): error TS2345: Argument of type 'Record<string, any>' is not assignable to parameter of type 'RejectExcessProperties<{ applied_steps_count?: number | undefined; checksum?: string | undefined; finished_at?: string | null | undefined; id?: string | undefined; logs?: string | null | undefined; migration_name?: string | undefined; rolled_back_at?: string | ... 1 more ... | undefined; started_at?: string | undefi...'.
src/products/bella-preschool/actions/student-actions.ts(281,11): error TS2345: Argument of type '"id"' is not assignable to parameter of type 'never'.
src/products/bella-preschool/actions/student-actions.ts(282,11): error TS2345: Argument of type '"tenant_id"' is not assignable to parameter of type 'never'.
```
