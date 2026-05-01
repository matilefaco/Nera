import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface Professional {
  id: string;
  slug: string;
  name: string;
  services?: any[];
}

export const PublicProfilePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        // The user specified this endpoint: GET /api/public/profile/:slug
        const response = await fetch(`/api/public/profile/${slug}`);
        if (!response.ok) throw new Error('Profissional não encontrado');
        const data = await response.json();
        
        // Ensure data includes id and slug as requested
        setProfessional(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (slug) loadProfile();
  }, [slug]);

  const handleBookingSubmit = async (bookingData: any) => {
    if (!professional) return;

    const payload = {
      professionalId: professional.id, // Fixed: use real Firestore ID, not slug
      serviceId: bookingData.serviceId,
      date: bookingData.date,
      time: bookingData.time,
      client: {
        name: bookingData.clientName,
        phone: bookingData.clientPhone,
        email: bookingData.clientEmail
      }
    };

    console.log("BOOKING PAYLOAD:", payload);

    try {
      const response = await fetch('/api/public/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        alert('Agendamento realizado com sucesso!');
      } else {
        alert('Erro: ' + result.error);
      }
    } catch (err: any) {
      console.error("Booking Error:", err);
      alert('Erro ao processar agendamento.');
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error || !professional) return <div>Erro: {error || 'Não encontrado'}</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{professional.name}</h1>
      <p className="text-gray-600 mb-8">@{professional.slug}</p>
      
      {/* Simplified Booking Form as placeholder for logic */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl mb-4">Agende seu horário</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          handleBookingSubmit({
            serviceId: 'service_default',
            date: fd.get('date'),
            time: fd.get('time'),
            clientName: fd.get('name'),
            clientPhone: fd.get('phone'),
            clientEmail: fd.get('email')
          });
        }}>
          <div className="grid gap-4">
            <input name="date" type="date" required className="border p-2" />
            <input name="time" type="time" required className="border p-2" />
            <input name="name" placeholder="Seu nome" required className="border p-2" />
            <input name="phone" placeholder="Seu WhatsApp" required className="border p-2" />
            <input name="email" placeholder="Seu email (opcional)" className="border p-2" />
            <button type="submit" className="bg-blue-600 text-white p-2 rounded">Reservar</button>
          </div>
        </form>
      </div>
    </div>
  );
};
