import rateLimit from "express-rate-limit";
const keyGenerator = (req) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const ips = typeof xForwardedFor === 'string' ? xForwardedFor.split(',') : xForwardedFor[0].split(',');
        return ips[0].trim();
    }
    return req.ip;
};
const skipHandler = () => {
    return process.env.NODE_ENV !== 'production';
};
export const bookingRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipHandler,
    message: {
        error: "Muitas tentativas. Tente novamente em alguns minutos."
    }
});
export const reviewSubmitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipHandler,
    message: {
        error: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos."
    }
});
export const publicReadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipHandler,
    message: {
        error: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos."
    }
});
export const authMutationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipHandler,
    message: {
        error: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos."
    }
});
