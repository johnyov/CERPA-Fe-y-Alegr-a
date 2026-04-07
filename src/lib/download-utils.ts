export const handleBookDownload = (book: any) => {
  if (!book) return;
  
  // Save to local storage for "Downloads" page
  const downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
  if (!downloads.some((d: any) => d.id === book.id)) {
    const newDownloads = [...downloads, { 
      ...book, 
      downloadedAt: new Date().toISOString() 
    }];
    localStorage.setItem('downloads', JSON.stringify(newDownloads));
  }

  // Trigger actual file download if pdfUrl is a real URL or base64
  if (book.pdfUrl) {
    const link = document.createElement('a');
    // Ensure URL is root-relative if it's a local path
    const finalUrl = book.pdfUrl.startsWith('files/') ? `/${book.pdfUrl}` : book.pdfUrl;
    link.href = finalUrl;
    link.download = `${book.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
