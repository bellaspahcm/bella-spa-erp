const CRITICAL = 'critical';
const WARNING = 'warning';
const MONEY_TOLERANCE = 1;
const SESSION_TOLERANCE = 0.01;
const DEFAULT_MAX_ROWS = 20000;
const STALE_OUTBOX_WARNING_HOURS = 24;

const SOURCE_ACCOUNTING_CHECKS = [
  {
    sourceTable: 'revenue',
    applies: (row) => normalize(row.status) === 'confirmed',
    label: 'confirmed revenue',
  },
  {
    sourceTable: 'salary_records',
    applies: (row) => ['paid', 'finalized', 'confirmed', 'published'].includes(normalize(row.status)),
    label: 'saved salary',
  },
  {
    sourceTable: 'session_logs',
    applies: (row) => normalize(row.status) === 'completed',
    label: 'completed session',
  },
  {
    sourceTable: 'inventory_logs',
    applies: (row) => isConsumptionReason(row.reason),
    label: 'inventory consumption',
  },
];

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function asFiniteNumber(value, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asMoney(value) {
  return Math.max(0, asFiniteNumber(value));
}

function normalizeDiscountPercent(value) {
  return Math.max(0, Math.min(100, asFiniteNumber(value)));
}

function getSupabaseCredentials(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  const missing = [];

  if (!supabaseUrl) {
    missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    missing.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    missing,
    isConfigured: missing.length === 0,
  };
}

function getBusinessDateContext(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const fromDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const nextMonthDate = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);

  return {
    monthDate: fromDate,
    nextMonthDate,
  };
}

function getHeaders(serviceRoleKey) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
}

function parseResponseError(bodyText) {
  if (!bodyText) {
    return 'No response body returned.';
  }

  try {
    const parsed = JSON.parse(bodyText);
    return [parsed.message, parsed.details, parsed.hint, parsed.code].filter(Boolean).join(' | ');
  } catch {
    return bodyText;
  }
}

function buildRestUrl(supabaseUrl, path, queryParams) {
  const base = `${trimTrailingSlash(supabaseUrl)}/rest/v1/${path}`;
  if (!queryParams) return base;

  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

async function fetchJsonOrThrow(fetchImpl, url, options, label) {
  const response = await fetchImpl(url, options);
  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${parseResponseError(bodyText)}`);
  }

  if (!bodyText) return null;
  return JSON.parse(bodyText);
}

async function fetchTableRows({
  supabaseUrl,
  serviceRoleKey,
  table,
  select,
  fetchImpl = globalThis.fetch,
  pageSize = 1000,
  maxRows = DEFAULT_MAX_ROWS,
}) {
  const rows = [];
  let offset = 0;

  while (offset < maxRows) {
    const url = buildRestUrl(supabaseUrl, encodeURIComponent(table), {
      select,
      order: 'id.asc',
      limit: pageSize,
      offset,
    });
    const page = await fetchJsonOrThrow(
      fetchImpl,
      url,
      { method: 'GET', headers: getHeaders(serviceRoleKey) },
      `${table} lookup`
    );

    if (!Array.isArray(page)) {
      throw new Error(`${table} lookup returned a non-array response.`);
    }

    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  if (rows.length >= maxRows) {
    throw new Error(`${table} invariant scan reached maxRows=${maxRows}. Increase DB_BUSINESS_INVARIANT_MAX_ROWS.`);
  }

  return rows;
}

async function loadBusinessDataset({
  supabaseUrl,
  serviceRoleKey,
  fetchImpl = globalThis.fetch,
  maxRows = DEFAULT_MAX_ROWS,
}) {
  const common = { supabaseUrl, serviceRoleKey, fetchImpl, maxRows };

  const [
    bookings,
    revenue,
    sessionLogs,
    salaryRecords,
    packages,
    packageMaterials,
    inventoryItems,
    inventoryLogs,
    journalEntries,
    journalLines,
    accountingOutbox,
  ] = await Promise.all([
    fetchTableRows({
      ...common,
      table: 'bookings',
      select:
        'id,booking_number,status,deposit_amount,full_price,discount_percent,total_sessions,completed_sessions,tenant_id,customer_id,package_id,package_name',
    }),
    fetchTableRows({
      ...common,
      table: 'revenue',
      select:
        'id,booking_id,amount,status,revenue_type,tenant_id,received_date,notes,payment_method,business_event_type,accounting_review_status,accounting_metadata',
    }),
    fetchTableRows({
      ...common,
      table: 'session_logs',
      select:
        'id,booking_id,status,completed_date,completed_by_ktv_id,tenant_id,session_number,business_event_type,accounting_review_status',
    }),
    fetchTableRows({
      ...common,
      table: 'salary_records',
      select:
        'id,ktv_id,month_year,tenant_id,status,paid_date,paid_method,notes,total_sessions,base_salary,session_bonus,rating_bonus,kpi_bonus,violations_deduction,service_percentage_bonus,total_salary,business_event_type,accounting_review_status',
    }),
    fetchTableRows({
      ...common,
      table: 'packages',
      select: 'id,name,tenant_id,session_multiplier,total_sessions',
    }),
    fetchTableRows({
      ...common,
      table: 'package_materials',
      select: 'id,tenant_id,package_id,item_id,quantity_per_session',
    }),
    fetchTableRows({
      ...common,
      table: 'inventory_items',
      select: 'id,tenant_id,name,stock_level,min_stock_level,unit,price_per_unit',
    }),
    fetchTableRows({
      ...common,
      table: 'inventory_logs',
      select:
        'id,tenant_id,item_id,change_amount,reason,session_log_id,created_at,business_event_type,accounting_review_status',
    }),
    fetchTableRows({
      ...common,
      table: 'journal_entries',
      select: 'id,tenant_id,entry_date,reference_type,reference_id,status,description',
    }),
    fetchTableRows({
      ...common,
      table: 'journal_lines',
      select: 'id,entry_id,account_id,debit_amount,credit_amount',
    }),
    fetchTableRows({
      ...common,
      table: 'accounting_outbox',
      select: 'id,tenant_id,event_type,reference_type,reference_id,status,retry_count,max_retries,last_error,created_at',
    }),
  ]);

  return {
    bookings,
    revenue,
    sessionLogs,
    salaryRecords,
    packages,
    packageMaterials,
    inventoryItems,
    inventoryLogs,
    journalEntries,
    journalLines,
    accountingOutbox,
  };
}

function calculatePriceAfterDiscount(input) {
  const fullPrice = asMoney(input.fullPrice);
  const discountPercent = normalizeDiscountPercent(input.discountPercent);
  return Math.max(0, fullPrice * (1 - discountPercent / 100));
}

function calculateConfirmedPaidAmount(revenues) {
  return (revenues || []).reduce((total, revenue) => {
    if (normalize(revenue.status) !== 'confirmed') return total;

    const amount = asMoney(revenue.amount);
    if (normalize(revenue.revenue_type) === 'refund') {
      return total - amount;
    }

    return total + amount;
  }, 0);
}

function calculateBookingPaymentState(input) {
  const priceAfterDiscount = calculatePriceAfterDiscount(input);
  const depositTarget = Math.min(asMoney(input.depositAmount), priceAfterDiscount);
  const totalPaid = Math.max(0, calculateConfirmedPaidAmount(input.revenues));
  const remainingDebt = Math.max(0, priceAfterDiscount - totalPaid);
  const depositDue = Math.max(0, depositTarget - totalPaid);
  const overpaidAmount = Math.max(0, totalPaid - priceAfterDiscount);
  const showDepositRequest =
    normalize(input.bookingStatus) === 'deposit_pending' &&
    depositDue > MONEY_TOLERANCE &&
    remainingDebt > MONEY_TOLERANCE;

  return {
    priceAfterDiscount,
    totalPaid,
    remainingDebt,
    depositTarget,
    depositDue,
    overpaidAmount,
    hasOutstandingDebt: remainingDebt > MONEY_TOLERANCE,
    showDepositRequest,
  };
}

function createResult(name, findings) {
  const criticalCount = findings.filter((finding) => finding.severity === CRITICAL).length;
  const warningCount = findings.filter((finding) => finding.severity === WARNING).length;

  return {
    name,
    ok: criticalCount === 0,
    criticalCount,
    warningCount,
    findings,
  };
}

function addFinding(findings, severity, code, message, details = {}) {
  findings.push({
    severity,
    code,
    message,
    ...details,
  });
}

function indexBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const value = row?.[key];
    if (value !== null && value !== undefined) {
      map.set(value, row);
    }
  });
  return map;
}

function groupBy(rows, getKey) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  });
  return map;
}

function isPackageRevenueType(revenueType) {
  return ['deposit', 'remaining_payment', 'package_payment', 'package_sale'].includes(normalize(revenueType));
}

function checkPaymentBookingRevenue(dataset) {
  const findings = [];
  const bookingsById = indexBy(dataset.bookings, 'id');
  const revenueByBookingId = groupBy(dataset.revenue, (row) => row.booking_id);

  dataset.revenue.forEach((row) => {
    const status = normalize(row.status);
    const revenueType = normalize(row.revenue_type);
    const booking = row.booking_id ? bookingsById.get(row.booking_id) : null;

    if (status === 'confirmed' && asFiniteNumber(row.amount) <= 0) {
      addFinding(findings, CRITICAL, 'confirmed_revenue_non_positive', 'Confirmed revenue must have a positive amount.', {
        recordId: row.id,
        sourceTable: 'revenue',
      });
    }

    if (status === 'confirmed' && isPackageRevenueType(revenueType) && !booking) {
      addFinding(findings, CRITICAL, 'package_revenue_missing_booking', 'Package payment revenue must point to a booking.', {
        recordId: row.id,
        sourceTable: 'revenue',
      });
    }

    if (booking && row.tenant_id !== booking.tenant_id) {
      addFinding(findings, CRITICAL, 'revenue_booking_tenant_mismatch', 'Revenue tenant must match booking tenant.', {
        recordId: row.id,
        bookingId: booking.id,
        sourceTable: 'revenue',
      });
    }
  });

  dataset.bookings.forEach((booking) => {
    const revenues = revenueByBookingId.get(booking.id) || [];
    const paymentState = calculateBookingPaymentState({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
    });

    if (
      normalize(booking.status) === 'deposit_pending' &&
      paymentState.depositTarget > MONEY_TOLERANCE &&
      paymentState.totalPaid + MONEY_TOLERANCE >= paymentState.depositTarget
    ) {
      addFinding(
        findings,
        CRITICAL,
        'deposit_paid_but_booking_still_pending',
        'Booking has enough confirmed deposit but is still deposit_pending; portal must not ask for that deposit again.',
        {
          recordId: booking.id,
          bookingNumber: booking.booking_number,
          totalPaid: paymentState.totalPaid,
          depositTarget: paymentState.depositTarget,
        }
      );
    }

    if (paymentState.overpaidAmount > MONEY_TOLERANCE) {
      addFinding(findings, WARNING, 'booking_overpaid', 'Confirmed payments exceed discounted booking price.', {
        recordId: booking.id,
        bookingNumber: booking.booking_number,
        totalPaid: paymentState.totalPaid,
        priceAfterDiscount: paymentState.priceAfterDiscount,
        overpaidAmount: paymentState.overpaidAmount,
      });
    }
  });

  return createResult('payment_booking_revenue', findings);
}

function checkLedger(dataset, context = {}) {
  const findings = [];
  const linesByEntryId = groupBy(dataset.journalLines, (line) => line.entry_id);

  dataset.journalEntries.forEach((entry) => {
    if (normalize(entry.status) !== 'posted') return;

    const lines = linesByEntryId.get(entry.id) || [];
    const debit = lines.reduce((sum, line) => sum + asFiniteNumber(line.debit_amount), 0);
    const credit = lines.reduce((sum, line) => sum + asFiniteNumber(line.credit_amount), 0);

    if (lines.length < 2) {
      addFinding(findings, CRITICAL, 'posted_journal_too_few_lines', 'Posted journal must have at least two lines.', {
        recordId: entry.id,
        sourceTable: 'journal_entries',
      });
    }

    if (Math.abs(debit - credit) > MONEY_TOLERANCE || debit <= MONEY_TOLERANCE) {
      addFinding(findings, CRITICAL, 'posted_journal_unbalanced', 'Posted journal debit and credit must balance.', {
        recordId: entry.id,
        sourceTable: 'journal_entries',
        debit,
        credit,
      });
    }
  });

  dataset.journalLines.forEach((line) => {
    const debit = asFiniteNumber(line.debit_amount);
    const credit = asFiniteNumber(line.credit_amount);

    if (debit < 0 || credit < 0 || (debit > MONEY_TOLERANCE && credit > MONEY_TOLERANCE)) {
      addFinding(findings, CRITICAL, 'invalid_journal_line_amounts', 'Journal line must not be negative or both debit and credit.', {
        recordId: line.id,
        entryId: line.entry_id,
        sourceTable: 'journal_lines',
        debit,
        credit,
      });
    }
  });

  dataset.accountingOutbox.forEach((event) => {
    const status = normalize(event.status);
    const retryCount = asFiniteNumber(event.retry_count);
    const maxRetries = asFiniteNumber(event.max_retries, 3);

    if (status === 'dead' || status === 'dead_lettered') {
      addFinding(findings, CRITICAL, 'dead_accounting_outbox', 'Accounting outbox event is dead-lettered.', {
        recordId: event.id,
        sourceTable: 'accounting_outbox',
        eventType: event.event_type,
      });
    }

    if (status === 'failed' && retryCount >= maxRetries) {
      addFinding(findings, CRITICAL, 'exhausted_accounting_outbox', 'Accounting outbox event exhausted retries.', {
        recordId: event.id,
        sourceTable: 'accounting_outbox',
        eventType: event.event_type,
        retryCount,
        maxRetries,
      });
    }

    if ((status === 'pending' || status === 'processing') && isOutboxStale(event, context.now)) {
      addFinding(findings, WARNING, 'stale_accounting_outbox', 'Accounting outbox event has been pending/processing for too long.', {
        recordId: event.id,
        sourceTable: 'accounting_outbox',
        eventType: event.event_type,
        status: event.status,
        createdAt: event.created_at,
      });
    }
  });

  return createResult('accounting_ledger', findings);
}

function getAccountingJournalReferenceType(eventType) {
  switch (normalize(eventType).toUpperCase()) {
    case 'PACKAGE_SALE':
      return 'PACKAGE_SALE';
    case 'SESSION_DONE':
      return 'SESSION_DONE';
    case 'EXPENSE_RECORDED':
      return 'EXPENSE';
    case 'SALARY_PAID':
      return 'SALARY_PAYMENT';
    case 'INVENTORY_CONSUMED':
      return 'INVENTORY_CONSUMPTION';
    case 'REFUND_ISSUED':
      return 'REFUND';
    default:
      return null;
  }
}

function hasAccountingOutboxEvent(dataset, eventType, referenceId) {
  return (dataset.accountingOutbox || []).some((event) =>
    normalize(event.event_type).toUpperCase() === eventType &&
    event.reference_id === referenceId
  );
}

function hasActiveJournalEntry(dataset, eventType, referenceId) {
  const journalReferenceType = getAccountingJournalReferenceType(eventType);
  if (!journalReferenceType) return false;

  return (dataset.journalEntries || []).some((entry) =>
    normalize(entry.status) !== 'canceled' &&
    entry.reference_type === journalReferenceType &&
    entry.reference_id === referenceId
  );
}

function hasAccountingSideEffect(dataset, eventType, referenceId) {
  return hasAccountingOutboxEvent(dataset, eventType, referenceId) ||
    hasActiveJournalEntry(dataset, eventType, referenceId);
}

function isOutboxStale(row, now) {
  if (!now || !row.created_at) return false;

  const createdAtMs = Date.parse(row.created_at);
  if (!Number.isFinite(createdAtMs)) return false;

  const ageHours = (now.getTime() - createdAtMs) / (1000 * 60 * 60);
  return ageHours > STALE_OUTBOX_WARNING_HOURS;
}

function getMissingAccountingSideEffectSeverity(row) {
  const reviewStatus = normalize(row?.accounting_review_status);

  if (['auto_posted', 'approved', 'posting_failed'].includes(reviewStatus)) {
    return CRITICAL;
  }

  return WARNING;
}

function monthMatches(value, monthDate) {
  return String(value || '').slice(0, 10) === monthDate;
}

function getPackageMultiplier(booking, packagesById, multiplierByPackageName) {
  const packageRow = booking?.package_id ? packagesById.get(booking.package_id) : null;
  const directMultiplier = asFiniteNumber(packageRow?.session_multiplier, NaN);
  if (Number.isFinite(directMultiplier) && directMultiplier > 0) return directMultiplier;

  const packageName = booking?.package_name || packageRow?.name || '';
  const mapped = multiplierByPackageName.get(packageName);
  return Number.isFinite(mapped) && mapped > 0 ? mapped : 1;
}

function checkSalary(dataset, context) {
  const findings = [];
  const salaryKeyCounts = new Map();
  const bookingsById = indexBy(dataset.bookings, 'id');
  const packagesById = indexBy(dataset.packages, 'id');
  const multiplierByPackageName = new Map();

  dataset.packages.forEach((pkg) => {
    if (!pkg.name) return;
    const multiplier = asFiniteNumber(pkg.session_multiplier, 1);
    multiplierByPackageName.set(pkg.name, multiplier > 0 ? multiplier : 1);
  });

  const liveSessionsByKtvTenantMonth = new Map();
  dataset.sessionLogs.forEach((session) => {
    if (
      normalize(session.status) !== 'completed' ||
      !session.completed_by_ktv_id ||
      !session.completed_date ||
      session.completed_date < context.monthDate ||
      session.completed_date >= context.nextMonthDate
    ) {
      return;
    }

    const booking = bookingsById.get(session.booking_id);
    const multiplier = getPackageMultiplier(booking, packagesById, multiplierByPackageName);
    const key = `${session.tenant_id || ''}:${session.completed_by_ktv_id}:${context.monthDate}`;
    liveSessionsByKtvTenantMonth.set(key, (liveSessionsByKtvTenantMonth.get(key) || 0) + multiplier);
  });

  dataset.salaryRecords.forEach((record) => {
    const key = `${record.tenant_id || ''}:${record.ktv_id}:${record.month_year}`;
    salaryKeyCounts.set(key, (salaryKeyCounts.get(key) || 0) + 1);

    const components = [
      ['base_salary', record.base_salary],
      ['session_bonus', record.session_bonus],
      ['rating_bonus', record.rating_bonus],
      ['kpi_bonus', record.kpi_bonus],
      ['violations_deduction', record.violations_deduction],
      ['service_percentage_bonus', record.service_percentage_bonus],
      ['total_salary', record.total_salary],
      ['total_sessions', record.total_sessions],
    ];

    components.forEach(([field, value]) => {
      if (asFiniteNumber(value) < 0) {
        addFinding(findings, CRITICAL, 'negative_salary_component', 'Salary components must not be negative.', {
          recordId: record.id,
          sourceTable: 'salary_records',
          field,
          value,
        });
      }
    });

    const expectedTotal = Math.max(
      0,
      asFiniteNumber(record.base_salary) +
        asFiniteNumber(record.session_bonus) +
        asFiniteNumber(record.rating_bonus) +
        asFiniteNumber(record.kpi_bonus) -
        asFiniteNumber(record.violations_deduction) -
        asFiniteNumber(record.service_percentage_bonus)
    );
    const totalSalary = asFiniteNumber(record.total_salary);

    if (Math.abs(expectedTotal - totalSalary) > MONEY_TOLERANCE) {
      addFinding(findings, CRITICAL, 'salary_total_component_mismatch', 'Salary total must match all stored components.', {
        recordId: record.id,
        sourceTable: 'salary_records',
        expectedTotal,
        totalSalary,
      });
    }

    const isCurrentDraft = monthMatches(record.month_year, context.monthDate) && normalize(record.status || 'draft') === 'draft';
    if (isCurrentDraft) {
      const liveKey = `${record.tenant_id || ''}:${record.ktv_id}:${context.monthDate}`;
      const liveSessions = liveSessionsByKtvTenantMonth.get(liveKey) || 0;
      const savedSessions = asFiniteNumber(record.total_sessions);

      if (Math.abs(savedSessions - liveSessions) > SESSION_TOLERANCE) {
        addFinding(findings, CRITICAL, 'draft_salary_session_count_drift', 'Draft salary sessions must match completed sessions with package multipliers.', {
          recordId: record.id,
          sourceTable: 'salary_records',
          savedSessions,
          liveSessions,
        });
      }
    }
  });

  salaryKeyCounts.forEach((count, key) => {
    if (count > 1) {
      addFinding(findings, CRITICAL, 'duplicate_salary_record', 'Only one salary record is allowed per tenant, KTV, and month.', {
        recordKey: key,
        count,
      });
    }
  });

  return createResult('salary', findings);
}

function isConsumptionReason(reason) {
  return ['session_consumption', 'session_consumed', 'consume', 'consumed', 'used'].includes(normalize(reason));
}

function checkInventory(dataset) {
  const findings = [];
  const sessionsById = indexBy(dataset.sessionLogs, 'id');
  const bookingsById = indexBy(dataset.bookings, 'id');
  const inventoryItemsById = indexBy(dataset.inventoryItems, 'id');
  const packageMaterialsByPackageId = groupBy(dataset.packageMaterials, (row) => row.package_id);
  const consumptionLogs = dataset.inventoryLogs.filter((log) => isConsumptionReason(log.reason));
  const consumptionLogsBySession = groupBy(consumptionLogs, (log) => log.session_log_id);
  const duplicateConsumptionKeys = new Map();

  dataset.inventoryItems.forEach((item) => {
    if (asFiniteNumber(item.stock_level) < 0) {
      addFinding(findings, CRITICAL, 'negative_inventory_stock', 'Inventory stock must not be negative.', {
        recordId: item.id,
        sourceTable: 'inventory_items',
        itemName: item.name,
        stockLevel: item.stock_level,
      });
    }
  });

  consumptionLogs.forEach((log) => {
    if (asFiniteNumber(log.change_amount) >= 0) {
      addFinding(findings, CRITICAL, 'consumption_log_not_negative', 'Session consumption inventory logs must reduce stock.', {
        recordId: log.id,
        sourceTable: 'inventory_logs',
        changeAmount: log.change_amount,
      });
    }

    const session = log.session_log_id ? sessionsById.get(log.session_log_id) : null;
    if (!session || normalize(session.status) !== 'completed') {
      addFinding(findings, CRITICAL, 'orphan_consumption_log', 'Inventory consumption log must point to a completed session.', {
        recordId: log.id,
        sourceTable: 'inventory_logs',
        sessionLogId: log.session_log_id,
      });
    }

    const duplicateKey = `${log.session_log_id || 'NO_SESSION'}:${log.item_id}`;
    duplicateConsumptionKeys.set(duplicateKey, (duplicateConsumptionKeys.get(duplicateKey) || 0) + 1);
  });

  duplicateConsumptionKeys.forEach((count, key) => {
    if (count > 1) {
      addFinding(findings, CRITICAL, 'duplicate_session_item_consumption', 'A session must not consume the same item more than once.', {
        recordKey: key,
        count,
      });
    }
  });

  dataset.sessionLogs.forEach((session) => {
    if (normalize(session.status) !== 'completed') return;

    const booking = bookingsById.get(session.booking_id);
    const packageMaterials = booking?.package_id ? packageMaterialsByPackageId.get(booking.package_id) || [] : [];
    const requiredMaterials = packageMaterials.filter((material) => asFiniteNumber(material.quantity_per_session) > 0);
    const requiresInventory = requiredMaterials.length > 0;

    if (requiresInventory && !consumptionLogsBySession.has(session.id)) {
      const materialSummary = requiredMaterials
        .map((material) => {
          const item = inventoryItemsById.get(material.item_id);
          const quantity = asFiniteNumber(material.quantity_per_session);
          const unit = item?.unit ? ` ${item.unit}` : '';
          return `${item?.name || material.item_id}: ${quantity}${unit}`;
        })
        .join('; ');

      addFinding(findings, CRITICAL, 'completed_session_missing_inventory_consumption', 'Completed session package has material rules but no consumption log.', {
        recordId: session.id,
        sessionLogId: session.id,
        bookingId: session.booking_id,
        bookingNumber: booking?.booking_number,
        packageId: booking?.package_id,
        packageName: booking?.package_name,
        materialCount: requiredMaterials.length,
        materialSummary,
        sourceTable: 'session_logs',
      });
    }
  });

  return createResult('inventory', findings);
}

function checkCrossModuleSideEffects(dataset) {
  const findings = [];
  const bookingsById = indexBy(dataset.bookings, 'id');
  const inventoryItemsById = indexBy(dataset.inventoryItems, 'id');
  const packageMaterialsByPackageId = groupBy(dataset.packageMaterials, (row) => row.package_id);
  const consumptionLogsBySession = groupBy(
    (dataset.inventoryLogs || []).filter((log) => isConsumptionReason(log.reason)),
    (log) => log.session_log_id
  );
  const completedSessionsByBooking = new Map();

  (dataset.revenue || []).forEach((row) => {
    if (normalize(row.status) !== 'confirmed') return;

    const revenueType = normalize(row.revenue_type);
    const booking = row.booking_id ? bookingsById.get(row.booking_id) : null;
    const hasValidBooking = booking && row.tenant_id === booking.tenant_id;
    if (
      isPackageRevenueType(revenueType) &&
      asFiniteNumber(row.amount) > 0 &&
      hasValidBooking &&
      !hasAccountingSideEffect(dataset, 'PACKAGE_SALE', row.id)
    ) {
      addFinding(findings, getMissingAccountingSideEffectSeverity(row), 'confirmed_package_revenue_missing_accounting_side_effect', 'Confirmed package revenue should have a PACKAGE_SALE outbox event or active journal entry.', {
        recordId: row.id,
        sourceTable: 'revenue',
        bookingId: row.booking_id,
        bookingNumber: booking?.booking_number,
        revenueType: row.revenue_type,
        revenueAmount: asFiniteNumber(row.amount),
        receivedDate: row.received_date,
      });
    }

    if (revenueType === 'refund' && !hasAccountingSideEffect(dataset, 'REFUND_ISSUED', row.id)) {
      addFinding(findings, getMissingAccountingSideEffectSeverity(row), 'confirmed_refund_missing_accounting_side_effect', 'Confirmed refund revenue should have a REFUND_ISSUED outbox event or active journal entry.', {
        recordId: row.id,
        sourceTable: 'revenue',
        bookingId: row.booking_id,
      });
    }
  });

  (dataset.sessionLogs || []).forEach((session) => {
    if (normalize(session.status) !== 'completed') return;

    if (session.booking_id) {
      completedSessionsByBooking.set(
        session.booking_id,
        (completedSessionsByBooking.get(session.booking_id) || 0) + 1
      );
    }

    if (!hasAccountingSideEffect(dataset, 'SESSION_DONE', session.id)) {
      addFinding(findings, getMissingAccountingSideEffectSeverity(session), 'completed_session_missing_session_done_side_effect', 'Completed session should have a SESSION_DONE outbox event or active journal entry.', {
        recordId: session.id,
        sessionLogId: session.id,
        sourceTable: 'session_logs',
        bookingId: session.booking_id,
        bookingNumber: bookingsById.get(session.booking_id)?.booking_number,
        ktvId: session.completed_by_ktv_id,
      });
    }

    const booking = bookingsById.get(session.booking_id);
    const packageMaterials = booking?.package_id ? packageMaterialsByPackageId.get(booking.package_id) || [] : [];
    const requiresInventory = packageMaterials.some((material) => asFiniteNumber(material.quantity_per_session) > 0);
    const consumptionLogs = consumptionLogsBySession.get(session.id) || [];
    if (
      requiresInventory &&
      consumptionLogs.length > 0 &&
      !hasAccountingSideEffect(dataset, 'INVENTORY_CONSUMED', session.id)
    ) {
      const consumptionSummary = consumptionLogs
        .map((log) => {
          const item = inventoryItemsById.get(log.item_id);
          const quantity = Math.abs(asFiniteNumber(log.change_amount));
          const unit = item?.unit ? ` ${item.unit}` : '';
          return `${item?.name || log.item_id}: ${quantity}${unit}`;
        })
        .join('; ');
      const consumptionCost = consumptionLogs.reduce((sum, log) => {
        const item = inventoryItemsById.get(log.item_id);
        return sum + Math.abs(asFiniteNumber(log.change_amount)) * asFiniteNumber(item?.price_per_unit);
      }, 0);

      addFinding(findings, getMissingAccountingSideEffectSeverity(session), 'inventory_consumption_missing_accounting_side_effect', 'Session inventory consumption should have an INVENTORY_CONSUMED outbox event or active journal entry.', {
        recordId: session.id,
        sessionLogId: session.id,
        sourceTable: 'session_logs',
        bookingId: session.booking_id,
        bookingNumber: booking?.booking_number,
        packageId: booking?.package_id,
        packageName: booking?.package_name,
        inventoryLogCount: consumptionLogs.length,
        consumptionSummary,
        consumptionCost,
      });
    }
  });

  completedSessionsByBooking.forEach((completedCount, bookingId) => {
    const booking = bookingsById.get(bookingId);
    if (!booking) return;

    const savedCompleted = asFiniteNumber(booking.completed_sessions, NaN);
    if (!Number.isFinite(savedCompleted)) return;

    if (Math.abs(savedCompleted - completedCount) > SESSION_TOLERANCE) {
      addFinding(findings, CRITICAL, 'booking_completed_sessions_drift', 'Booking completed_sessions must match completed session logs.', {
        recordId: booking.id,
        bookingNumber: booking.booking_number,
        sourceTable: 'bookings',
        savedCompleted,
        completedSessionLogs: completedCount,
      });
    }
  });

  (dataset.salaryRecords || []).forEach((record) => {
    if (normalize(record.status) !== 'paid') return;

    if (asFiniteNumber(record.total_salary) > 0 && record.ktv_id && !hasAccountingSideEffect(dataset, 'SALARY_PAID', record.id)) {
      addFinding(findings, getMissingAccountingSideEffectSeverity(record), 'paid_salary_missing_accounting_side_effect', 'Paid salary record should have a SALARY_PAID outbox event or active journal entry.', {
        recordId: record.id,
        sourceTable: 'salary_records',
        ktvId: record.ktv_id,
        salaryAmount: asFiniteNumber(record.total_salary),
        salaryMonth: record.month_year,
        paidDate: record.paid_date,
        paymentMethod: record.paid_method,
      });
    }
  });

  return createResult('cross_module_side_effects', findings);
}

function checkAccountingReadiness(dataset) {
  const findings = [];

  SOURCE_ACCOUNTING_CHECKS.forEach((check) => {
    const rows = dataset[check.sourceTable === 'salary_records' ? 'salaryRecords' : check.sourceTable === 'session_logs' ? 'sessionLogs' : check.sourceTable === 'inventory_logs' ? 'inventoryLogs' : check.sourceTable] || [];

    rows.forEach((row) => {
      if (!check.applies(row)) return;

      if (normalize(row.accounting_review_status) === 'posting_failed') {
        addFinding(findings, CRITICAL, 'accounting_posting_failed', `${check.label} has POSTING_FAILED accounting status.`, {
          recordId: row.id,
          sourceTable: check.sourceTable,
        });
      }

      if (!row.business_event_type) {
        addFinding(findings, WARNING, 'missing_business_event_type', `${check.label} is missing business_event_type.`, {
          recordId: row.id,
          sourceTable: check.sourceTable,
        });
      }

      if (normalize(row.accounting_review_status) === 'needs_review') {
        addFinding(findings, WARNING, 'accounting_needs_review', `${check.label} needs accounting review before full automation.`, {
          recordId: row.id,
          sourceTable: check.sourceTable,
        });
      }
    });
  });

  return createResult('accounting_readiness_metadata', findings);
}

function runBusinessInvariantChecksOnDataset(dataset, options = {}) {
  const now = options.now || new Date();
  const context = {
    ...getBusinessDateContext(now),
    now,
    ...(options.context || {}),
  };

  return [
    checkPaymentBookingRevenue(dataset),
    checkLedger(dataset, context),
    checkSalary(dataset, context),
    checkInventory(dataset),
    checkCrossModuleSideEffects(dataset),
    checkAccountingReadiness(dataset),
  ];
}

async function runBusinessInvariantChecks({
  supabaseUrl,
  serviceRoleKey,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  maxRows = DEFAULT_MAX_ROWS,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime.');
  }

  const dataset = await loadBusinessDataset({
    supabaseUrl,
    serviceRoleKey,
    fetchImpl,
    maxRows,
  });
  const results = runBusinessInvariantChecksOnDataset(dataset, { now });

  return {
    datasetCounts: Object.fromEntries(Object.entries(dataset).map(([key, rows]) => [key, rows.length])),
    context: getBusinessDateContext(now),
    results,
  };
}

function summarizeBusinessInvariantResults(results, options = {}) {
  const critical = results.flatMap((result) => result.findings.filter((finding) => finding.severity === CRITICAL));
  const warnings = results.flatMap((result) => result.findings.filter((finding) => finding.severity === WARNING));
  const failOnWarning = Boolean(options.failOnWarning);

  return {
    checked: results.length,
    criticalCount: critical.length,
    warningCount: warnings.length,
    failedChecks: results.filter((result) => result.criticalCount > 0 || (failOnWarning && result.warningCount > 0)),
    isHealthy: critical.length === 0 && (!failOnWarning || warnings.length === 0),
  };
}

function formatFinding(finding) {
  const suffix = [
    finding.sourceTable ? `table=${finding.sourceTable}` : null,
    finding.recordId ? `id=${finding.recordId}` : null,
    finding.bookingNumber ? `booking=${finding.bookingNumber}` : null,
    finding.recordKey ? `key=${finding.recordKey}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return suffix ? `${finding.code}: ${finding.message} (${suffix})` : `${finding.code}: ${finding.message}`;
}

function printBusinessInvariantResults(results, sampleLimit = 20) {
  results.forEach((result) => {
    const marker = result.criticalCount > 0 ? 'FAIL' : result.warningCount > 0 ? 'WARN' : 'OK';
    const stream = result.criticalCount > 0 ? console.error : console.log;
    stream(`[${marker}] ${result.name}: ${result.criticalCount} critical, ${result.warningCount} warning`);
  });

  const findings = results.flatMap((result) =>
    result.findings.map((finding) => ({
      checkName: result.name,
      finding,
    }))
  );

  findings.slice(0, sampleLimit).forEach(({ checkName, finding }) => {
    const stream = finding.severity === CRITICAL ? console.error : console.warn;
    stream(`  - [${finding.severity}] ${checkName}: ${formatFinding(finding)}`);
  });

  if (findings.length > sampleLimit) {
    console.warn(`  ... ${findings.length - sampleLimit} additional findings omitted from console output.`);
  }
}

async function main() {
  const optional = process.env.DB_BUSINESS_INVARIANTS_OPTIONAL === '1';
  const failOnWarning = process.env.DB_BUSINESS_INVARIANTS_FAIL_ON_WARNING === '1';
  const maxRows = Math.max(1000, asFiniteNumber(process.env.DB_BUSINESS_INVARIANT_MAX_ROWS, DEFAULT_MAX_ROWS));
  const credentials = getSupabaseCredentials();

  if (!credentials.isConfigured) {
    const message = `Business invariant check missing config: ${credentials.missing.join(', ')}.`;
    if (optional) {
      console.log(`${message} Skipping because DB_BUSINESS_INVARIANTS_OPTIONAL=1.`);
      return;
    }

    console.error(message);
    process.exit(1);
  }

  let invariantRun;
  try {
    invariantRun = await runBusinessInvariantChecks({
      ...credentials,
      maxRows,
    });
  } catch (error) {
    console.error('Could not run business invariant checks.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log(`Business invariant month: ${invariantRun.context.monthDate}`);
  console.log(`Business invariant rows: ${JSON.stringify(invariantRun.datasetCounts)}`);
  printBusinessInvariantResults(invariantRun.results);

  const summary = summarizeBusinessInvariantResults(invariantRun.results, { failOnWarning });
  if (!summary.isHealthy) {
    console.error(
      `Business invariant check failed: ${summary.criticalCount} critical, ${summary.warningCount} warning.`
    );
    process.exit(1);
  }

  console.log(
    `Business invariant check passed: ${summary.checked} check groups, ${summary.warningCount} non-blocking warnings.`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  CRITICAL,
  WARNING,
  buildRestUrl,
  calculateBookingPaymentState,
  checkAccountingReadiness,
  checkCrossModuleSideEffects,
  checkInventory,
  checkLedger,
  checkPaymentBookingRevenue,
  checkSalary,
  fetchTableRows,
  getBusinessDateContext,
  getSupabaseCredentials,
  isConsumptionReason,
  loadBusinessDataset,
  parseResponseError,
  runBusinessInvariantChecks,
  runBusinessInvariantChecksOnDataset,
  summarizeBusinessInvariantResults,
};
