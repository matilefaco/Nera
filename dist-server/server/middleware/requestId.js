import * as crypto from "crypto";
export function requestIdMiddleware(req, res, next) {
    const xRequestId = req.headers["x-request-id"];
    const requestId = (Array.isArray(xRequestId) ? xRequestId[0] : xRequestId) || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
}
