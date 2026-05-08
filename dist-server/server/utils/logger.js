export function maskEmail(email) {
    if (!email || typeof email !== "string")
        return "";
    const parts = email.split("@");
    if (parts.length !== 2)
        return "***";
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2)
        return `***@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
}
export function maskPhone(phone) {
    if (!phone || typeof phone !== "string")
        return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4)
        return "****";
    return `***${digits.slice(-4)}`;
}
export function maskToken(token) {
    if (!token || typeof token !== "string")
        return "";
    if (token.length <= 6)
        return "***";
    return `${token.substring(0, 6)}***`;
}
export function maskUid(uid) {
    if (!uid || typeof uid !== "string")
        return "";
    if (uid.length <= 6)
        return "***";
    return `${uid.substring(0, 6)}***`;
}
export function sanitizeMeta(meta) {
    if (!meta || typeof meta !== "object")
        return meta;
    const sensitiveKeys = [
        "authorization",
        "bearer",
        "token",
        "accesstoken",
        "refreshtoken",
        "idtoken",
        "manageslug",
        "reviewtoken",
        "phone",
        "whatsapp",
        "email",
        "clientemail",
        "clientphone",
        "stripesecret",
        "secret",
        "password",
        "rawbody",
    ];
    if (Array.isArray(meta)) {
        return meta.map(sanitizeMeta);
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(meta)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));
        if (isSensitive) {
            if (lowerKey.includes("email"))
                sanitized[key] = maskEmail(value);
            else if (lowerKey.includes("phone") || lowerKey.includes("whatsapp"))
                sanitized[key] = maskPhone(value);
            else
                sanitized[key] = maskToken(value);
        }
        else if (typeof value === "object" && value !== null) {
            sanitized[key] = sanitizeMeta(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
function processError(error) {
    if (!error)
        return undefined;
    if (error instanceof Error) {
        const errObj = {
            name: error.name,
            message: sanitizeMeta({ msg: error.message }).msg || error.message,
        };
        if (error.code)
            errObj.code = error.code;
        if (error.status)
            errObj.status = error.status;
        if (process.env.NODE_ENV !== "production") {
            errObj.stack = error.stack;
        }
        return errObj;
    }
    if (typeof error === "string")
        return { message: error };
    if (typeof error === "object") {
        const obj = error;
        return {
            name: obj.name,
            message: obj.message || obj.error,
            code: obj.code,
            status: obj.status
        };
    }
    return { message: "Unknown error" };
}
function writeLog(level, scope, message, payload) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        scope,
        message,
        requestId: payload?.requestId,
        userId: maskUid(payload?.userId),
        professionalId: maskUid(payload?.professionalId),
        appointmentId: payload?.appointmentId,
        status: payload?.status,
        meta: sanitizeMeta(payload?.meta),
        error: processError(payload?.error),
    };
    const logString = JSON.stringify(logEntry);
    switch (level) {
        case "info":
            console.info(logString);
            break;
        case "warn":
            console.warn(logString);
            break;
        case "error":
            console.error(logString);
            break;
    }
}
export const logger = {
    info: (scope, message, payload) => writeLog("info", scope, message, payload),
    warn: (scope, message, payload) => writeLog("warn", scope, message, payload),
    error: (scope, message, payload) => writeLog("error", scope, message, payload),
};
