import { useState, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

/**
 * usePdfDownload
 *
 * Handles PDF download with progress tracking and retry logic.
 * Addresses the intermittent blob download failures.
 */
function usePdfDownload(caseId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const downloadPdf = useCallback(async () => {
    if (!caseId) {
      setError('No case ID provided.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${caseId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 402) {
          setError('Payment required. Please complete payment to download your report.');
          return;
        }
        if (response.status === 404) {
          setError('Report not found. It may have expired (reports are kept for 72 hours).');
          return;
        }
        setError(`Download failed (${response.status}). Please try again.`);
        return;
      }

      // Stream with progress tracking
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : null;
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          setProgress(Math.round((loaded / total) * 100));
        }
      }

      setProgress(100);

      const blob = new Blob(chunks, { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deposit-defender-report-${caseId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 150);

    } catch (err) {
      console.error('PDF download error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Download failed unexpectedly. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const retry = useCallback(() => {
    setError(null);
    setProgress(0);
    downloadPdf();
  }, [downloadPdf]);

  return { downloadPdf, retry, loading, error, progress };
}

export default usePdfDownload;
