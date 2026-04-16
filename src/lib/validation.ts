import { z } from 'zod';

// WhatsApp: only numbers, 10 or 11 digits
export const whatsappSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length >= 10 && val.length <= 11, {
    message: "WhatsApp deve ter 10 ou 11 dígitos numéricos"
  });

// Email: valid format
export const emailSchema = z.string().email("Email inválido");

// Name: min 2 chars
export const nameSchema = z.string().min(2, "Nome deve ter pelo menos 2 caracteres");

// Service Schema
export const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome do serviço é obrigatório"),
  price: z.number().positive("Preço deve ser maior que zero"),
  duration: z.number().positive("Duração deve ser maior que zero"),
  description: z.string().optional(),
});

// Working Hours Schema
export const workingHoursSchema = z.object({
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Horário de início inválido"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Horário de término inválido"),
  workingDays: z.array(z.number().min(0).max(6)).min(1, "Selecione pelo menos um dia de trabalho"),
}).refine(data => {
  const [startH, startM] = data.startTime.split(':').map(Number);
  const [endH, endM] = data.endTime.split(':').map(Number);
  return (endH > startH) || (endH === startH && endM > startM);
}, {
  message: "Horário de término deve ser após o horário de início",
  path: ["endTime"]
});

// User Profile Schema (Partial for onboarding/updates)
export const userProfileSchema = z.object({
  name: nameSchema.optional(),
  username: z.string().min(3).optional(),
  email: emailSchema.optional(),
  whatsapp: whatsappSchema.optional(),
  bio: z.string().max(500).optional(),
  serviceMode: z.enum(['studio', 'home', 'hybrid']).optional(),
  services: z.array(serviceSchema).optional(),
  workingHours: workingHoursSchema.optional(),
});
