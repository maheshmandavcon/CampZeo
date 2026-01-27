import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export a chart element to PDF
 * @param elementRef - React ref to the chart container element
 * @param filename - Name for the downloaded PDF file (without extension)
 * @param title - Optional title to add to the PDF
 */
export async function exportChartToPDF(
    elementRef: React.RefObject<HTMLElement | null>,
    filename: string,
    title?: string
): Promise<void> {
    if (!elementRef.current) {
        console.error('Chart element not found');
        return;
    }

    try {
        // Capture the chart as a canvas
        const canvas = await html2canvas(elementRef.current, {
            scale: 2, // Higher quality
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
        });

        // Convert canvas to image
        const imgData = canvas.toDataURL('image/png');

        // Calculate PDF dimensions
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Create PDF
        const pdf = new jsPDF({
            orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
            unit: 'mm',
            format: 'a4',
        });

        // Add title if provided
        if (title) {
            pdf.setFontSize(16);
            pdf.text(title, 10, 10);
            pdf.addImage(imgData, 'PNG', 10, 20, imgWidth - 20, imgHeight);
        } else {
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth - 20, imgHeight);
        }

        // Add metadata
        const currentDate = new Date().toLocaleDateString();
        pdf.setFontSize(8);
        pdf.text(`Generated on ${currentDate}`, 10, pageHeight - 10);

        // Download the PDF
        pdf.save(`${filename}.pdf`);
    } catch (error) {
        console.error('Error exporting chart to PDF:', error);
        throw error;
    }
}

/**
 * Export multiple charts to a single PDF
 * @param charts - Array of chart references and titles
 * @param filename - Name for the downloaded PDF file (without extension)
 */
export async function exportMultipleChartsToPDF(
    charts: Array<{ ref: React.RefObject<HTMLElement | null>; title: string }>,
    filename: string
): Promise<void> {
    try {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const imgWidth = 190; // A4 width minus margins
        let yPosition = 10;

        for (let i = 0; i < charts.length; i++) {
            const chart = charts[i];

            if (!chart.ref.current) {
                console.warn(`Chart ${i} element not found, skipping`);
                continue;
            }

            // Capture the chart as a canvas
            const canvas = await html2canvas(chart.ref.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
            });

            const imgData = canvas.toDataURL('image/png');
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Add new page if needed (except for first chart)
            if (i > 0) {
                pdf.addPage();
                yPosition = 10;
            }

            // Add title
            pdf.setFontSize(14);
            pdf.text(chart.title, 10, yPosition);
            yPosition += 10;

            // Add chart image
            pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);
        }

        // Add metadata on last page
        const currentDate = new Date().toLocaleDateString();
        pdf.setFontSize(8);
        pdf.text(`Generated on ${currentDate}`, 10, 287);

        // Download the PDF
        pdf.save(`${filename}.pdf`);
    } catch (error) {
        console.error('Error exporting charts to PDF:', error);
        throw error;
    }
}
