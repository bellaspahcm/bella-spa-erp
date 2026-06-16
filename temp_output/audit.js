"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditEvent = createAuditEvent;
/**
 * Create a standardized audit event.
 *
 * @param params - Event parameters
 * @returns AuditEvent ready to be logged
 */
function createAuditEvent(params) {
    var _a;
    return __assign(__assign({ id: crypto.randomUUID(), timestamp: new Date().toISOString() }, params), { metadata: (_a = params.metadata) !== null && _a !== void 0 ? _a : {} });
}
