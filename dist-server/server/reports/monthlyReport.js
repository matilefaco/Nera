import PDFDocument from 'pdfkit';
export async function generateMonthlyReportPDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
        doc.on('error', reject);
        // Paleta de cores
        const colors = {
            terracotta: '#A85C3A',
            ink: '#18120E',
            stone: '#6B5E54',
            white: '#FFFFFF',
            mist: '#F5F2F0'
        };
        // Header
        doc
            .fillColor(colors.terracotta)
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('NERA', 50, 50)
            .font('Helvetica')
            .fontSize(10)
            .fillColor(colors.stone)
            .text('Relatório Mensal de Performance', 50, 75);
        doc
            .fillColor(colors.ink)
            .fontSize(16)
            .text(data.professionalName, 400, 50, { align: 'right' })
            .fontSize(10)
            .fillColor(colors.stone)
            .text(data.professionalSpecialty, 400, 70, { align: 'right' })
            .fillColor(colors.terracotta)
            .font('Helvetica-Bold')
            .text(data.month, 400, 85, { align: 'right' })
            .font('Helvetica');
        doc.moveTo(50, 110).lineTo(545, 110).strokeColor(colors.mist).stroke();
        // Seção 1: Resumo Financeiro
        doc
            .fillColor(colors.ink)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Resumo do Mês', 50, 130)
            .font('Helvetica');
        const startY = 155;
        const itemWidth = 120;
        const itemHeight = 60;
        // Grid 2x2
        const metrics = [
            { label: 'Faturamento Total', value: `R$ ${data.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
            { label: 'Agendamentos', value: data.confirmedAppointments.toString() },
            { label: 'Ticket Médio', value: `R$ ${data.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
            { label: 'Novos Clientes', value: data.newClients.toString() }
        ];
        metrics.forEach((metric, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 50 + col * (itemWidth + 100);
            const y = startY + row * (itemHeight + 20);
            doc
                .rect(x, y, itemWidth + 80, itemHeight)
                .fill(colors.mist);
            doc
                .fillColor(colors.stone)
                .fontSize(8)
                .text(metric.label.toUpperCase(), x + 10, y + 15);
            doc
                .fillColor(colors.ink)
                .fontSize(14)
                .font('Helvetica-Bold')
                .text(metric.value, x + 10, y + 30)
                .font('Helvetica');
        });
        // Seção 2: Top Serviços
        let currentY = 320;
        doc
            .fillColor(colors.ink)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Top Serviços', 50, currentY)
            .font('Helvetica');
        currentY += 25;
        data.topServices.slice(0, 3).forEach((service, index) => {
            doc
                .rect(50, currentY, 495, 40)
                .fill(index % 2 === 0 ? colors.white : colors.mist);
            doc
                .fillColor(colors.ink)
                .fontSize(10)
                .text(service.name, 60, currentY + 15);
            doc
                .fillColor(colors.stone)
                .fontSize(9)
                .text(`${service.count} agendamentos`, 300, currentY + 15);
            doc
                .fillColor(colors.ink)
                .fontSize(10)
                .text(`R$ ${service.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 450, currentY + 15, { align: 'right' });
            currentY += 40;
        });
        // Seção 3: Dias mais movimentados
        currentY += 30;
        doc
            .fillColor(colors.ink)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Dias mais movimentados', 50, currentY)
            .font('Helvetica');
        currentY += 25;
        data.topDays.slice(0, 5).forEach((day, index) => {
            const barWidth = (day.count / Math.max(...data.topDays.map(d => d.count))) * 300;
            doc
                .fillColor(colors.stone)
                .fontSize(9)
                .text(day.day, 50, currentY + 5);
            doc
                .rect(120, currentY, barWidth, 15)
                .fill(colors.terracotta);
            doc
                .fillColor(colors.ink)
                .fontSize(9)
                .text(day.count.toString(), 130 + barWidth, currentY + 5);
            currentY += 25;
        });
        // Footer
        doc
            .fillColor(colors.stone)
            .fontSize(8)
            .text(`Gerado pelo Nera • usenera.com • ${new Date().toLocaleDateString('pt-BR')}`, 50, doc.page.height - 50, { align: 'center' });
        doc.end();
    });
}
