export function normalizeId(value: unknown): string {
  return String(value || "").replace(/^"+|"+$/g, "").trim();
}

export function removeEmptyFields(obj: any) {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
      newObj[key] = obj[key];
    }
  });
  return newObj;
}

export function generateReservationCode(date: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getClientKey(whatsapp: string, email: string, name: string) {
  if (whatsapp) return whatsapp.replace(/\D/g, '');
  if (email) return email.toLowerCase().trim();
  return name.toLowerCase().replace(/\s/g, '');
}
