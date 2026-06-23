import { config } from "dotenv";
config();
console.log("ID:", process.env.ZAPI_INSTANCE_ID);
console.log("TOKEN:", process.env.ZAPI_INSTANCE_TOKEN || process.env.ZAPI_TOKEN);
