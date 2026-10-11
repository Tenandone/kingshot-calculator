/**
 * Sum an explicitly bounded ordinary-building source table, not game formulas.
 * Current level is excluded; target level is included. No buffs, prerequisites,
 * discounts, TG transitions, DOM, storage, fetch or calculation-gate access.
 */
export class RangeComparisonError extends RangeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RangeComparisonError';
    this.code = code;
    this.details = details;
  }
}

const safeAmount = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fail = (code, message, details) => { throw new RangeComparisonError(code, message, details); };
const aggregateStatus = issues => issues.some(issue => issue.status === 'missing') ? 'missing' : issues.length ? 'held' : 'verified';
const issueFor = (level, row, cell, code, status) => ({
  level,
  rowKey: typeof row?.key === 'string' ? row.key : null,
  code,
  status,
  sourceStatus: typeof cell?.status === 'string' ? cell.status : null,
  reason: typeof cell?.reason === 'string' ? cell.reason : null,
});

function exactCell(cell, unit) {
  if (cell == null) return { code: 'missing_cell', status: 'missing' };
  if (typeof cell !== 'object' || Array.isArray(cell)) return { code: 'invalid_cell', status: 'held' };
  if (cell.status === 'missing') return { code: 'source_missing', status: 'missing' };
  if (cell.unit !== unit) return { code: 'unit_mismatch', status: 'held' };
  if (cell.status === 'held') return { code: 'source_held', status: 'held' };
  if (cell.status !== 'verified_source_parse') return { code: 'unrecognized_verification_status', status: 'held' };
  if (cell.calculationEligible !== true) return { code: 'exact_sum_not_eligible', status: 'held' };
  if (!safeAmount(cell.value)) return { code: 'invalid_exact_amount', status: 'held' };
  return { value: cell.value, status: 'verified', abbreviated: false };
}

function displayedCell(cell, unit, exact) {
  if (exact.status === 'verified') return exact;
  // Only a reviewed, consistently parsed K/M resource amount may supply an
  // approximate display total. Other held values never become estimates.
  if (unit === 'resource_unit' && cell?.unit === unit && cell.status === 'held' &&
      cell.precision === 'abbreviated' && cell.reason === 'abbreviated_precision_unverified' &&
      cell.calculationEligible === false && cell.displayCalculationEligible === true) {
    if (safeAmount(cell.displayValue)) return { value: cell.displayValue, status: 'verified', abbreviated: true };
    return { code: 'invalid_display_amount', status: 'held' };
  }
  return exact;
}

function finishSum(sum, issues) {
  if (issues.length) return null;
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
    issues.push({ level: null, rowKey: null, code: 'sum_exceeds_safe_integer', status: 'held', sourceStatus: null, reason: null });
    return null;
  }
  return Number(sum);
}

function aggregateField(levels, rowsByLevel, field, unit) {
  const issues = [], displayIssues = [];
  let exactSum = 0n, displaySum = 0n, abbreviated = false;
  for (const level of levels) {
    const row = rowsByLevel.get(level);
    if (!row) {
      const issue = issueFor(level, null, null, 'missing_row', 'missing');
      issues.push(issue); displayIssues.push({ ...issue }); continue;
    }
    const cell = row.cells && Object.hasOwn(row.cells, field) ? row.cells[field] : undefined;
    const exact = exactCell(cell, unit), display = displayedCell(cell, unit, exact);
    if (exact.status === 'verified') exactSum += BigInt(exact.value);
    else issues.push(issueFor(level, row, cell, exact.code, exact.status));
    if (display.status === 'verified') { displaySum += BigInt(display.value); abbreviated ||= display.abbreviated; }
    else displayIssues.push(issueFor(level, row, cell, display.code, display.status));
  }
  const value = finishSum(exactSum, issues), displayedValueTotal = finishSum(displaySum, displayIssues);
  return {
    value,
    status: aggregateStatus(issues),
    issues,
    displayedValueTotal,
    approximate: displayedValueTotal !== null && abbreviated,
    displayStatus: aggregateStatus(displayIssues),
    displayIssues,
    unit,
  };
}

/**
 * Input cells follow the building adapter contract:
 * { value, status, unit, calculationEligible, precision, reason,
 *   displayValue, displayCalculationEligible }.
 * A verified zero is data; an empty range is a mathematical zero. Neither
 * missing cells nor omitted resource icons are interpreted as zero.
 * @throws {RangeComparisonError} for invalid range or ambiguous row identity.
 */
export function summarizeRange(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_ARGUMENT', 'A range request is required.');
  const { rows, currentLevel, targetLevel, resourceKeys, bounds, stage = 'normal' } = input;
  if (stage !== 'normal') fail('UNSUPPORTED_STAGE', 'Only ordinary levels can be summed; TG stages require a separately verified progression.', { stage });
  if (!bounds || !safeAmount(bounds.minLevel) || !safeAmount(bounds.maxLevel) || bounds.minLevel > bounds.maxLevel) {
    fail('INVALID_BOUNDS', 'Explicit nonnegative integer level bounds are required.');
  }
  if (!safeAmount(currentLevel) || !safeAmount(targetLevel)) fail('INVALID_LEVEL', 'Current and target levels must be nonnegative safe integers.');
  if (currentLevel < bounds.minLevel || currentLevel > bounds.maxLevel || targetLevel < bounds.minLevel || targetLevel > bounds.maxLevel) {
    fail('LEVEL_OUT_OF_BOUNDS', 'Current and target levels must lie within the supplied bounds.', { currentLevel, targetLevel, minLevel: bounds.minLevel, maxLevel: bounds.maxLevel });
  }
  if (targetLevel < currentLevel) fail('REVERSED_RANGE', 'Target level cannot precede current level.', { currentLevel, targetLevel });
  if (targetLevel - currentLevel > 10000) fail('RANGE_TOO_LARGE', 'A source-table range cannot exceed 10,000 steps.');
  if (!Array.isArray(rows)) fail('INVALID_ROWS', 'Rows must be an array.');
  if (!Array.isArray(resourceKeys) || !resourceKeys.length || resourceKeys.some(key => typeof key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(key) || key === 'timeSeconds') || new Set(resourceKeys).size !== resourceKeys.length) {
    fail('INVALID_RESOURCE_KEYS', 'Resource keys must be a nonempty list of unique resource identifiers.');
  }
  const rowsByLevel = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !['normal', 'tg'].includes(row.stage)) fail('INVALID_ROW', 'Each row must have an explicit normal or tg stage.');
    if (row.stage !== stage) continue;
    if (!safeAmount(row.level)) fail('INVALID_ROW_LEVEL', 'Ordinary row levels must be nonnegative safe integers.', { rowKey: typeof row.key === 'string' ? row.key : null });
    if (rowsByLevel.has(row.level)) fail('DUPLICATE_LEVEL', 'More than one ordinary row has the same level.', { level: row.level });
    rowsByLevel.set(row.level, row);
  }
  const levels = Array.from({ length: targetLevel - currentLevel }, (_, index) => currentLevel + index + 1);
  const resources = Object.fromEntries(resourceKeys.map(field => [field, aggregateField(levels, rowsByLevel, field, 'resource_unit')]));
  const timeSeconds = aggregateField(levels, rowsByLevel, 'timeSeconds', 'second');
  const fields = [...Object.values(resources), timeSeconds];
  return {
    kind: 'source-table-sum',
    stage,
    range: { currentLevel, targetLevel, levels, stepCount: levels.length, empty: levels.length === 0, currentExcluded: true, targetIncluded: true },
    resources,
    timeSeconds,
    status: aggregateStatus(fields.flatMap(field => field.issues)),
    displayStatus: aggregateStatus(fields.flatMap(field => field.displayIssues)),
    actualGameCalculationAllowed: false,
  };
}
