import { jsPDF } from "jspdf";
import { supabase } from "../supabaseClient";

export async function downloadQuotationPdf(quotationData) {
  try {
    // 1. Initialize jsPDF document
    const doc = new jsPDF();

    // 2. Build PDF Layout Content
    doc.setFontSize(20);
    doc.text("QUOTATION", 14, 22);

    doc.setFontSize(12);
    doc.text(`Client Name: ${quotationData.client_name || "N/A"}`, 14, 40);
    doc.text(`Media Type: ${quotationData.media_type || "N/A"}`, 14, 50);
    doc.text(`Media Used: ${quotationData.media_used || "N/A"}`, 14, 60);
    doc.text(`Reference (Billboard ID): ${quotationData.reference || "N/A"}`, 14, 70);
    doc.text(`Location: ${quotationData.media_location || "N/A"}`, 14, 80);
    doc.text(`Period: ${quotationData.period || "N/A"}`, 14, 90);
    doc.text(`Printing Cost: $${quotationData.printing_cost || 0}`, 14, 100);
    doc.text(`Total (w/o printing): $${quotationData.total_cost_wo_printing || 0}`, 14, 110);
    doc.text(`Total (with printing): $${quotationData.total_cost_with_printing || 0}`, 14, 120);

    const fileName = `quotation_${quotationData.booking_id || Date.now()}.pdf`;

    // 3. Trigger Local Desktop Download
    doc.save(fileName);

    // 4. Convert PDF to Blob for Supabase Storage Upload
    const pdfBlob = doc.output("blob");

    // 5. Upload to 'Quotations' Storage Bucket in Supabase
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("Quotations")
      .upload(`public/${fileName}`, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 6. Get Public URL of the Uploaded PDF
    const { data: urlData } = supabase.storage
      .from("Quotations")
      .getPublicUrl(`public/${fileName}`);

    const pdfPublicUrl = urlData.publicUrl;

    // 7. Update quotation_pdf_url in 'bookings' table for matching booking_id
    if (quotationData.booking_id) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ quotation_pdf_url: pdfPublicUrl })
        .eq("booking_id", quotationData.booking_id);

      if (updateError) throw updateError;
    }

    alert("PDF generated, downloaded, and linked to booking successfully!");
    return pdfPublicUrl;
  } catch (error) {
    console.error("Error generating/uploading PDF:", error);
    alert(`PDF generation failed: ${error.message}`);
  }
}