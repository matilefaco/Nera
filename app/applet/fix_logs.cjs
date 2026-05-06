const fs = require('fs');

function processBookingRoutes() {
  const path = 'server/routes/bookingRoutes.ts';
  let content = fs.readFileSync(path, 'utf8');

  // Import logger if not present
  if (!content.includes('import { logger, maskEmail, maskPhone, maskToken, maskUid } from "../utils/logger.js"')) {
    content = content.replace('import { getDb } from "../firebaseAdmin.js";', 
    'import { getDb } from "../firebaseAdmin.js";\nimport { logger, maskEmail, maskPhone, maskToken, maskUid } from "../utils/logger.js";');
  }

  // API_BOOKING
  content = content.replace(
    /console\.error\(`\[API_BOOKING\] REJECTED: Missing fields`, appointmentData\);/g,
    'logger.warn("BOOKING", "Rejected missing fields", { meta: { hasName: Boolean(appointmentData?.clientName) } });'
  );
  content = content.replace(
    /console\.log\(`\[API_BOOKING\] Transaction starting. ApptID: \$\{apptRef\.id\}`\);/g,
    'logger.info("BOOKING", "Transaction starting");'
  );

  // SUBMIT REVIEW
  content = content.replace(
    /console\.log\(`\[SUBMIT REVIEW\] Success for token \$\{token\}`\);/g,
    'logger.info("REVIEW", "Review submitted successfully", { meta: { reviewToken: maskToken(token) } });'
  );
  content = content.replace(
    /console\.error\(`\[SUBMIT REVIEW ERROR\]`, err\);/g,
    'logger.error("REVIEW", "Submit review error", { error: err, meta: { reviewToken: maskToken(token) } });'
  );

  // RESERVATION / SUCCESS FAILED
  content = content.replace(/console\.log\('FAILED \(not found\)'\);\n/g, '');
  content = content.replace(/console\.log\('SUCCESS'\);\n/g, '');

  content = content.replace(
    /console\.error\('\[FIRESTORE ERROR\]', err\.message\);/g,
    'logger.error("FIRESTORE", "Query error", { error: err });'
  );

  content = content.replace(
    /console\.error\(`\[DEBUG RUN\] Failed:`, err\.message\);/g,
    'logger.error("DEBUG", "Debug run failed", { error: err });'
  );
  content = content.replace(
    /console\.log\(`\[FIX DUPLICATES\] Scanning for \$\{professionalId\}\.\.\.`\);/g,
    'logger.info("SYSTEM", "Fix duplicates scan starting", { professionalId: maskUid(professionalId) });'
  );

  // CONFIRM
  content = content.replace(
    /console\.log\(`\[CONFIRM APPOINTMENT\] Request received.*?\);/g,
    'logger.info("BOOKING", "Confirm request received", { professionalId: maskUid(professionalId) });'
  );
  content = content.replace(
    /console\.log\(`\[CONFIRM ENDPOINT HIT\].*?\);\n/g,
    ''
  );
  content = content.replace(
    /console\.error\(`\[CONFIRM TRANSACTION\] Appointment \$\{appointmentId\} NOT FOUND`\);/g,
    'logger.error("BOOKING", "Appointment not found during confirm transaction");'
  );
  content = content.replace(
    /console\.error\(`\[CONFIRM TRANSACTION\] Appointment \$\{appointmentId\} has NO DATA`\);/g,
    'logger.error("BOOKING", "Appointment has no data during confirm transaction");'
  );
  content = content.replace(
    /console\.log\(`\[CONFIRM PRECHECK\]`, {[\s\S]*?}\);\n/g,
    ''
  );
  content = content.replace(
    /console\.error\(`\[CONFIRM TRANSACTION\] Permission Denied.*?\);/g,
    'logger.warn("BOOKING", "Confirm permission denied");'
  );
  content = content.replace(
    /console\.error\(`\[CONFIRM TRANSACTION\] Missing date\/time.*?\);/g,
    'logger.error("BOOKING", "Missing date/time configuration");'
  );
  content = content.replace(
    /console\.log\(`\[CONFIRM TRANSACTION\] Checking lock at: \$\{lockId\}`\);\n/g,
    ''
  );
  content = content.replace(
    /console\.warn\(`\[CONFIRM TRANSACTION\] FAIL: Slot occupied by \$\{lockData\.appointmentId\}`\);/g,
    'logger.warn("BOOKING", "Confirm failed, slot occupied");'
  );
  content = content.replace(
    /console\.log\(`\[CONFIRM TRANSACTION\] Updating appointment \$\{appointmentId\}\.\.\.`\);\n/g,
    ''
  );
  content = content.replace(
    /console\.log\(`\[CONFIRM TRANSACTION\] Creating\/Updating lock \$\{lockId\}\.\.\.`\);\n/g,
    ''
  );
  content = content.replace(
    /console\.log\(`\[CONFIRM ENDPOINT SUCCESS\] for \$\{appointmentId\}`\);/g,
    'logger.info("BOOKING", "Confirm finished successfully");'
  );
  content = content.replace(
    /console\.error\(`\[CONFIRM ENDPOINT ERROR\]`, {[\s\S]*?}\);/g,
    'logger.error("BOOKING", "Confirm endpoint error", { error: err });'
  );

  // COMPLETE
  content = content.replace(
    /console\.log\(`\[COMPLETE ENDPOINT\] Starting complete for confirmed appt \$\{appointmentId\} by \$\{uid\}`\);/g,
    'logger.info("BOOKING", "Complete request received");'
  );
  content = content.replace(
    /console\.log\(`\[COMPLETE ENDPOINT\] SUCCESS for \$\{appointmentId\}`\);/g,
    'logger.info("BOOKING", "Complete success");'
  );
  content = content.replace(
    /console\.error\(`\[COMPLETE ENDPOINT ERROR\]`, err\);/g,
    'logger.error("BOOKING", "Complete endpoint error", { error: err });'
  );

  // DECLINE
  content = content.replace(
    /console\.log\(`\[DECLINE ENDPOINT\] Starting decline for \$\{appointmentId\} by uid \$\{uid\}`\);/g,
    'logger.info("BOOKING", "Decline request received");'
  );
  content = content.replace(
    /console\.log\(`\[DECLINE ENDPOINT\] SUCCESS for \$\{appointmentId\}`\);/g,
    'logger.info("BOOKING", "Decline success");'
  );
  content = content.replace(
    /console\.error\(`\[DECLINE ENDPOINT ERROR\]`, err\);/g,
    'logger.error("BOOKING", "Decline endpoint error", { error: err });'
  );

  // CANCEL
  content = content.replace(
    /console\.log\(`\[CANCEL ENDPOINT\] Starting cancel for confirmed appt \$\{appointmentId\} by \$\{uid\}`\);/g,
    'logger.info("BOOKING", "Cancel request received");'
  );
  content = content.replace(
    /console\.log\(`\[CANCEL ENDPOINT\] SUCCESS for \$\{appointmentId\}`\);/g,
    'logger.info("BOOKING", "Cancel success");'
  );
  content = content.replace(
    /console\.error\(`\[CANCEL ENDPOINT ERROR\]`, err\);/g,
    'logger.error("BOOKING", "Cancel endpoint error", { error: err });'
  );

  content = content.replace(
    /console\.log\(`\[CANCEL BY CLIENT\] SUCCESS via slug \$\{manageSlug\}`\);/g,
    'logger.info("BOOKING", "Cancel by client success");'
  );
  content = content.replace(
    /console\.error\(`\[CANCEL BY CLIENT ERROR\]`, err\);/g,
    'logger.error("BOOKING", "Cancel by client error", { error: err });'
  );

  // LOCK CLEANUP
  content = content.replace(/console\.log\(`\[LOCK CLEANUP\].*?;\n/g, '');

  fs.writeFileSync(path, content, 'utf8');
}

function processNotificationRoutes() {
  const path = 'server/routes/notificationRoutes.ts';
  let content = fs.readFileSync(path, 'utf8');

  // Import logger if not present
  if (!content.includes('import { logger, maskEmail, maskPhone, maskToken, maskUid } from "../utils/logger.js"')) {
    content = content.replace('import { getDb } from "../firebaseAdmin.js";', 
    'import { getDb } from "../firebaseAdmin.js";\nimport { logger, maskEmail, maskPhone, maskToken, maskUid } from "../utils/logger.js";');
  }

  // PUSH
  content = content.replace(/console\.log\(`\[PUSH\] No subscriptions found for professional \$\{professionalId\}`\);\n/g, '');
  content = content.replace(/console\.log\(`\[PUSH\] Subscription expired or removed for \$\{doc\.id\}`\);\n/g, '');
  content = content.replace(/console\.error\(`\[PUSH\] Error sending to \$\{doc\.id\}:`, err\);/g, 'logger.error("PUSH", "Error sending push to doc", { error: err });');
  content = content.replace(/console\.error\(`\[PUSH\] Error in sendPushToUser:`, error\);/g, 'logger.error("PUSH", "Error in sendPushToUser", { error });');
  
  // ALERT
  content = content.replace(/console\.log\('\[ALERT\] Missing data for last-minute check:', {[\s\S]*?}\);\n/g, '');
  content = content.replace(/console\.log\(`\[ALERT\] Cancellation check: \$\{diffHours\.toFixed\(2\)\}h until appointment \$\{apptId\}`\);\n/g, '');
  content = content.replace(/console\.log\(`\[ALERT\] Alert already exists for \$\{apptId\}`\);\n/g, '');
  content = content.replace(/console\.log\(`\[ALERT\] SUCCESS: Last-minute cancellation alert created for \$\{apptId\}`\);\n/g, '');
  content = content.replace(/console\.error\('\[ALERT\] Error creating last-minute alert:', err\);/g, 'logger.error("ALERT", "Error creating last-minute alert", { error: err });');
  
  // EMAIL
  content = content.replace(/console\.log\('\[EMAIL\] starting send \(Test Endpoint\)'\);\n/g, '');
  content = content.replace(/console\.error\('\[EMAIL\] failed error \(Test Endpoint\):', err\);\n/g, '');
  
  // RAW EMAIL DEPRECATED
  content = content.replace(/console\.warn\("sendRawEmail is deprecated"\);/g, 'logger.warn("EMAIL", "sendRawEmail is deprecated");');

  // PUSH SUBSCRIBE
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] START"\);\n/g, '');
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] uid body:", userId\);\n/g, '');
  content = content.replace(/console\.error\("\[PUSH SUBSCRIBE\] Missing subscription or userId"\);/g, 'logger.warn("PUSH", "Missing subscription or userId");');
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] Token verified for UID:", verifiedUid\);\n/g, '');
  content = content.replace(/console\.error\("\[PUSH SUBSCRIBE\] Token verification failed:", err\);/g, 'logger.error("PUSH", "Token verification failed", { error: err });');
  content = content.replace(/console\.error\("\[PUSH SUBSCRIBE\] Missing Authorization header"\);/g, 'logger.warn("PUSH", "Missing Authorization header");');
  content = content.replace(/console\.error\(`\[PUSH SUBSCRIBE\] UID mismatch.*/g, 'logger.warn("PUSH", "UID mismatch in push subscribe");');
  content = content.replace(/console\.error\("\[PUSH SUBSCRIBE\] Invalid subscription structure:", JSON\.stringify\(subscription\)\);/g, 'logger.warn("PUSH", "Invalid subscription structure");');
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] Derived SubscriptionId:", subscriptionId\);\n/g, '');
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] saving at:", `users\/\$\{userId\}\/push_subscriptions\/\$\{subscriptionId\}`\);\n/g, '');
  content = content.replace(/console\.error\("\[PUSH SUBSCRIBE\] Verification failed: Document was not saved in users collection"\);/g, 'logger.error("PUSH", "Verification failed: Document was not saved");');
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] saving to debug collection at:".*\);\n/g, '');
  content = content.replace(/console\.log\("\[PUSH SUBSCRIBE\] SAVED OK for user", userId\);/g, 'logger.info("PUSH", "Push subscription saved successfully");');
  content = content.replace(/console\.error\("\[PUSH SUBSCRIBE\] CRITICAL ERROR:", error\);/g, 'logger.error("PUSH", "Critical error during push subscribe", { error });');

  // BOOKING FLOW
  content = content.replace(/console\.log\(`\[BOOKING FLOW\] Processing notification \$\{type\}\.\.\.`\);\n/g, '');
  content = content.replace(/console\.log\(`\[BOOKING FLOW\] Debug Payload for \$\{type\}:`, JSON\.stringify\(payload, null, 2\)\);\n/g, '');

  content = content.replace(/console\.error\(`\[Notification Service\] ERROR:`, error\.message\);/g, 'logger.error("NOTIFICATION", "Notification Service Error", { error });');
  content = content.replace(/console\.log\(`\[Cron\] Starting 24h reminders for appointments on \$\{tomorrowStr\}\.\.\.`\);/g, 'logger.info("CRON", "Starting 24h reminders");');
  content = content.replace(/console\.error\(`\[Cron\] Email delivery failed for \$\{apptId\}:`, emailErr\);/g, 'logger.error("CRON", "Email delivery failed", { error: emailErr });');

  fs.writeFileSync(path, content, 'utf8');
}

processBookingRoutes();
processNotificationRoutes();
console.log("Done.");
