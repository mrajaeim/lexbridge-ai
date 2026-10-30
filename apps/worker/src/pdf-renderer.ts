import { mkdir, createWriteStream } from 'fs';
import { dirname } from 'path';
import PDFDocument from 'pdfkit';

type PdfJob = {
  conversation: {
    title: string;
    messages: Array<{
      role: string;
      content: string;
      citations: Array<{ label: string; excerpt: string }>;
    }>;
  };
};

export function renderPdf(job: PdfJob, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdir(dirname(filePath), { recursive: true }, (mkdirError) => {
      if (mkdirError) {
        reject(mkdirError);
        return;
      }
      const doc = new PDFDocument({ margin: 56 });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(18).text('LexBridge AI');
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#444444').text('Conversation export. Prototype only. Not legal advice.');
      doc.moveDown(0.4);
      doc.fillColor('#111111').fontSize(12).text(job.conversation.title);
      doc.fontSize(9).fillColor('#555555').text(`Generated ${new Date().toISOString()}`);
      doc.moveDown();
      for (const message of job.conversation.messages) {
        doc.fillColor('#0f6b4c').fontSize(11).text(message.role === 'USER' ? 'Question' : 'Answer');
        doc.fillColor('#111111').fontSize(11).text(message.content || ' ');
        if (message.citations.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor('#333333').text('Sources');
          for (const citation of message.citations) {
            doc.fontSize(10).text(`${citation.label}: ${citation.excerpt}`);
          }
        }
        doc.moveDown();
      }
      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
      doc.on('error', reject);
    });
  });
}
