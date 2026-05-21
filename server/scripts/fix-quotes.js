import fs from 'fs';

function fixQuotes(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/logger\.info\("AI", "\[(.*?)', /g, 'logger.info("AI", "[$1", { meta: ');
  content = content.replace(/logger\.info\("AI", "\[(.*?)'\);/g, 'logger.info("AI", "[$1");');
  content = content.replace(/logger\.info\("AI", "\[(.*?)`, /g, 'logger.info("AI", `[$1`, { meta: ');
  content = content.replace(/logger\.info\("AI", "\[(.*?)`\);/g, 'logger.info("AI", `[$1`);');

  content = content.replace(/logger\.warn\("AI", "\[(.*?)', /g, 'logger.warn("AI", "[$1", { meta: ');
  content = content.replace(/logger\.warn\("AI", "\[(.*?)'\);/g, 'logger.warn("AI", "[$1");');
  content = content.replace(/logger\.warn\("AI", "\[(.*?)`, /g, 'logger.warn("AI", `[$1`, { meta: ');
  content = content.replace(/logger\.warn\("AI", "\[(.*?)`\);/g, 'logger.warn("AI", `[$1`);');

  content = content.replace(/logger\.error\("AI", "\[(.*?)', /g, 'logger.error("AI", "[$1", { meta: ');
  content = content.replace(/logger\.error\("AI", "\[(.*?)'\);/g, 'logger.error("AI", "[$1");');
  content = content.replace(/logger\.error\("AI", "\[(.*?)`, /g, 'logger.error("AI", `[$1`, { error: ');
  content = content.replace(/logger\.error\("AI", "\[(.*?)`\);/g, 'logger.error("AI", `[$1`);');

  content = content.replace(/logger\.warn\("AI", "\[(.*?)";/g, 'logger.warn("AI", "[$1");');
  content = content.replace(/logger\.error\("AI", "\[(.*?)";/g, 'logger.error("AI", "[$1");');
  content = content.replace(/logger\.info\("AI", "\[(.*?)";/g, 'logger.info("AI", "[$1");');

  content = content.replace(/logger\.error\("AI", "\[(.*?)", /g, 'logger.error("AI", "[$1", { error: ');
  content = content.replace(/logger\.info\("AI", "\[(.*?)", /g, 'logger.info("AI", "[$1", { meta: ');

  // Fix the specific syntax errors remaining
  content = content.replace(/meta:  \);/g, 'meta: {} });');
  
  // Custom manual replace for standard cases:
  // Analytics
  content = content.replace('logger.info("AI", "[BioAI] Entry /generate-content:\', { name, specialty });', 'logger.info("AI", "[BioAI] Entry /generate-content", { meta: { name, specialty } });');
  content = content.replace('logger.warn("AI", "[BioAI] Rate limit hit:\', ip);', 'logger.warn("AI", "[BioAI] Rate limit hit", { meta: { ip } });');
  content = content.replace('logger.info("AI", "[BioAI] NVIDIA_API_KEY present:\', !!process.env.NVIDIA_API_KEY);', 'logger.info("AI", "[BioAI] NVIDIA_API_KEY present", { meta: { key: !!process.env.NVIDIA_API_KEY } });');
  content = content.replace('logger.error("AI", "[BioAI] NVIDIA_API_KEY is missing in server environment");', 'logger.error("AI", "[BioAI] NVIDIA_API_KEY is missing in server environment");');
  content = content.replace('logger.info("AI", "[BioAI] Calling NVIDIA Model meta/llama-3.1-8b-instruct\');', 'logger.info("AI", "[BioAI] Calling NVIDIA Model meta/llama-3.1-8b-instruct");');
  content = content.replace('logger.info("AI", "[BioAI] Raw response from NVIDIA:\', content);', 'logger.info("AI", "[BioAI] Raw response from NVIDIA", { meta: { content } });');
  content = content.replace('logger.error("AI", "[BioAI] JSON parse error from model output:\", content);', 'logger.error("AI", "[BioAI] JSON parse error from model output", { error: { content } });');
  content = content.replace('logger.info("AI", "[BioAI] Successfully generated parsed:`, parsed);', 'logger.info("AI", "[BioAI] Successfully generated parsed", { meta: { parsed } });');
  content = content.replace('logger.error("AI", "[BioAI] Generation error:\", error.message);', 'logger.error("AI", "[BioAI] Generation error", { error: { message: error.message } });');
  content = content.replace('logger.error("AI", "[PortfolioAI] NVIDIA_API_KEY is missing");', 'logger.error("AI", "[PortfolioAI] NVIDIA_API_KEY is missing");');
  content = content.replace('logger.error("AI", "[PortfolioAI] error:\", error.message);', 'logger.error("AI", "[PortfolioAI] error", { error: { message: error.message } });');
  content = content.replace('logger.warn("AI", "[REPORT AUTH] User ${req.uid} attempted to access report of ${professionalId}. Access denied.`);', 'logger.warn("AI", `[REPORT AUTH] User ${req.uid} attempted to access report of ${professionalId}. Access denied.`);');
  content = content.replace('logger.error("AI", "[REPORT] Generation error:\", error);', 'logger.error("AI", "[REPORT] Generation error", { error });');

  // Utils
  content = content.replace('logger.info("AI", "[EMAIL_SKIP_DUPLICATE] Event ${eventKey} already sent for ${appointmentId}`);', 'logger.info("AI", `[EMAIL_SKIP_DUPLICATE] Event ${eventKey} already sent for ${appointmentId}`);');
  content = content.replace('logger.error("AI", "[EMAIL_GUARD_ERROR]\', err);', 'logger.error("AI", "[EMAIL_GUARD_ERROR]", { error: err });');
  content = content.replace('logger.error("AI", "[EMAIL_MARK_ERROR]\', err);', 'logger.error("AI", "[EMAIL_MARK_ERROR]", { error: err });');
  content = content.replace('logger.warn("AI", "[WhatsApp-Meta] Configuration missing (META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)\');', 'logger.warn("AI", "[WhatsApp-Meta] Configuration missing");');
  content = content.replace('logger.warn("AI", "[WhatsApp-Meta] Request failed:\', err);', 'logger.warn("AI", "[WhatsApp-Meta] Request failed", { meta: err });');
  content = content.replace('logger.warn("AI", "[WhatsApp] CallMeBot notification failed:\', err);', 'logger.warn("AI", "[WhatsApp] CallMeBot notification failed", { meta: err });');
  content = content.replace('logger.info("AI", "[NVIDIA] model used: ${model}`);', 'logger.info("AI", `[NVIDIA] model used: ${model}`);');
  content = content.replace('logger.info("AI", "[NVIDIA] latency: ${latency}ms`);', 'logger.info("AI", `[NVIDIA] latency: ${latency}ms`);');
  content = content.replace('logger.info("AI", "[NVIDIA] success: true`);', 'logger.info("AI", `[NVIDIA] success: true`);');
  content = content.replace('logger.warn("AI", "[NVIDIA] error (Attempt ${attempt + 1}):`, isTimeout ? "Timeout" : err.message);', 'logger.warn("AI", `[NVIDIA] error (Attempt ${attempt + 1})`, { meta: { error: isTimeout ? "Timeout" : err.message } });');
  content = content.replace('if (attempt === 0) logger.info("AI", "[NVIDIA] Retrying...`);', 'if (attempt === 0) logger.info("AI", `[NVIDIA] Retrying...`);');
  content = content.replace('logger.error("AI", "[NVIDIA] final failure:`, lastError.message);', 'logger.error("AI", `[NVIDIA] final failure`, { error: { message: lastError.message } });');
  content = content.replace('logger.info("AI", "[AI SERVICE] description rejected by semantic guard: unhas talking about unrelated area. Content: \\"${content}\\"");', 'logger.info("AI", `[AI SERVICE] description rejected by semantic guard: unhas talking about unrelated area. Content: "${content}"`);');
  content = content.replace('logger.info("AI", "[AI SERVICE] NVIDIA success for ${serviceName}`);', 'logger.info("AI", `[AI SERVICE] NVIDIA success for ${serviceName}`);');
  content = content.replace('logger.error("AI", "[AI SERVICE] NVIDIA failed in description: ${error.message}`);', 'logger.error("AI", `[AI SERVICE] NVIDIA failed in description: ${error.message}`);');
  content = content.replace('logger.info("AI", "[AI SERVICE] Using fallback for ${serviceName}`);', 'logger.info("AI", `[AI SERVICE] Using fallback for ${serviceName}`);');
  content = content.replace('logger.info("AI", "[AI SERVICE] fallback used for category: ${cat}`);', 'logger.info("AI", `[AI SERVICE] fallback used for category: ${cat}`);');

  fs.writeFileSync(file, content, 'utf8');
}

fixQuotes('server/routes/analyticsRoutes.ts');
fixQuotes('server/utils.ts');

console.log("Quotes fixed");
