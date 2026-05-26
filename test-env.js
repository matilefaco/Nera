console.log("Secret key prefix:", process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 7) : "MISSING");
console.log("Pro price:", process.env.STRIPE_PRICE_PRO ? process.env.STRIPE_PRICE_PRO.substring(0, 6) + "..." + process.env.STRIPE_PRICE_PRO.slice(-4) : "MISSING");
console.log("Essencial price:", process.env.STRIPE_PRICE_ESSENCIAL ? process.env.STRIPE_PRICE_ESSENCIAL.substring(0, 6) + "..." + process.env.STRIPE_PRICE_ESSENCIAL.slice(-4) : "MISSING");
