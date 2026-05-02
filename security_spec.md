# Security Spec: client_summaries

## Data Invariants
1. A client summary must belong to a valid professional.
2. The summary ID must uniquely identify the professional-client relationship (`professionalId_clientKey`).
3. Total spent and counts must be non-negative.
4. Timestamps (`updatedAt`, `createdAt`) must be valid ISO strings or server timestamps.

## The "Dirty Dozen" Payloads (Attacks)
1. **Identity Spoof**: Try to create a summary for a different professional.
2. **Key Poisoning**: Try to use a huge string as `clientKey`.
3. **Ghost Field**: Add `isVerified: true` to a summary.
4. **LTV Inflation**: Update `totalSpent` directly to a high value without a transaction.
5. **Cross-Pro Read**: Try to read summaries belonging to another professional.
6. **No-Show Reset**: Try to set `noShowCount` to 0 as a client.
7. **Email/Phone Swap**: Change `clientPhone` or `clientEmail` in a way that doesn't match the `clientKey` (integrity check).
8. **Impersonation**: Create a summary where `professionalId` is the attacker's UID but the document ID belongs to another pro.
9. **Timestamp Manipulation**: Set a future `updatedAt`.
10. **Data Scraping**: List all summaries without filtering by `professionalId`.
11. **Orphaned Summary**: Create a summary for a non-existent professional.
12. **Malicious Schema**: Set `totalAppointments` to a negative number.

## Firestore Rules Draft
```javascript
function isValidClientSummary(data) {
  return data.professionalId is string &&
         data.clientKey is string && data.clientKey.size() <= 128 &&
         data.clientName is string && data.clientName.size() <= 100 &&
         data.totalSpent is number && data.totalSpent >= 0 &&
         data.totalAppointments is number && data.totalAppointments >= 0 &&
         data.confirmedAppointments is number && data.confirmedAppointments >= 0;
}

match /client_summaries/{summaryId} {
  allow read: if isSignedIn() && resource.data.professionalId == request.auth.uid;
  allow create: if isSignedIn() && request.auth.uid == incoming().professionalId && isValidClientSummary(incoming());
  allow update: if isSignedIn() && request.auth.uid == resource.data.professionalId &&
                  incoming().professionalId == existing().professionalId &&
                  isValidClientSummary(incoming());
}
```
