import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { filesApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, Loader2, ArrowRight, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function UploadPage() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = useCallback(async (file) => {
    const validTypes = ['.csv', '.pdf'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExt)) { toast.error('Invalid file type. Please upload a CSV or PDF file.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Maximum size is 10MB.'); return; }

    setUploading(true);
    setUploadResult(null);
    setPreviewData(null);
    try {
      const response = await filesApi.upload(file);
      setUploadResult(response.data);
      if (response.data.status === 'parsed') {
        const previewResponse = await filesApi.preview(response.data.file_id);
        setPreviewData(previewResponse.data);
        toast.success(`Parsed ${response.data.transaction_count} transactions`);
      } else if (response.data.status === 'failed') {
        toast.error(response.data.error || 'Failed to parse file');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
      setUploadResult({ status: 'failed', error: error.response?.data?.detail });
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files?.[0]) handleFileUpload(files[0]);
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleImport = useCallback(async () => {
    if (!uploadResult?.file_id) return;
    setImporting(true);
    try {
      await filesApi.import(uploadResult.file_id);
      toast.success('Transactions imported successfully!');
      navigate('/transactions');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [uploadResult?.file_id, navigate]);

  const handleCancel = useCallback(() => { setUploadResult(null); setPreviewData(null); }, []);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="upload-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Upload Statements</h1>
        <p className="text-fg-secondary mt-1">Upload your bank statements to analyze your spending</p>
      </div>

      {!uploadResult && (
        <DropZone uploading={uploading} dragActive={dragActive} onDrag={handleDrag} onDrop={handleDrop} onFileSelect={handleFileSelect} />
      )}

      {uploadResult && uploadResult.status !== 'failed' && (
        <ParseSuccessCard uploadResult={uploadResult} previewData={previewData} />
      )}

      {uploadResult?.status === 'failed' && (
        <FailedUploadCard error={uploadResult.error} onRetry={handleCancel} />
      )}

      {previewData?.transactions?.length > 0 && (
        <TransactionPreviewTable previewData={previewData} importing={importing} onImport={handleImport} onCancel={handleCancel} />
      )}

      <SupportedFormatsCard />
    </div>
  );
}

function DropZone({ uploading, dragActive, onDrag, onDrop, onFileSelect }) {
  return (
    <Card className="border-border-color">
      <CardContent className="p-8">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive ? 'border-accent-primary bg-accent-primary/5' : 'border-border-color hover:border-fg-muted'}`}
          onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop} data-testid="upload-dropzone"
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-accent-primary animate-spin mb-4" />
              <p className="text-lg font-medium text-fg-default">Uploading and parsing...</p>
              <p className="text-sm text-fg-muted mt-1">This may take a moment</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-fg-muted mx-auto mb-4" />
              <p className="text-lg font-medium text-fg-default mb-2">Drop your file here or click to browse</p>
              <p className="text-sm text-fg-muted mb-6">Supports CSV and PDF files up to 10MB</p>
              <input type="file" accept=".csv,.pdf" onChange={onFileSelect} className="hidden" id="file-upload" data-testid="file-input" />
              <label htmlFor="file-upload">
                <Button asChild className="bg-accent-primary hover:bg-accent-primary/90">
                  <span data-testid="upload-button"><Upload className="w-4 h-4 mr-2" />Select File</span>
                </Button>
              </label>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ParseSuccessCard({ uploadResult, previewData }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-accent-positive" />
          <CardTitle className="font-heading text-lg">File Parsed Successfully</CardTitle>
        </div>
        <CardDescription>Review the transactions before importing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'File', value: previewData?.filename || uploadResult.filename },
            { label: 'Bank', value: uploadResult.bank_name || 'Unknown' },
            { label: 'Transactions', value: uploadResult.transaction_count || 0 },
            { label: 'Total Amount', value: formatCurrency(Math.abs(uploadResult.total_amount || 0)) },
          ].map((item) => (
            <div key={item.label} className="p-4 bg-bg-subtle rounded-lg">
              <p className="text-sm text-fg-muted">{item.label}</p>
              <p className="font-medium text-fg-default truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FailedUploadCard({ error, onRetry }) {
  return (
    <Card className="border-border-color border-destructive/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-destructive/10"><XCircle className="w-6 h-6 text-destructive" /></div>
          <div className="flex-1">
            <h3 className="font-medium text-fg-default mb-1">Upload Failed</h3>
            <p className="text-sm text-fg-muted">{error || 'Failed to parse the file. Please check the format and try again.'}</p>
          </div>
          <Button variant="outline" onClick={onRetry}>Try Again</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionPreviewTable({ previewData, importing, onImport, onCancel }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Transaction Preview</CardTitle>
        <CardDescription>Showing first {Math.min(previewData.transactions.length, 10)} of {previewData.total_transactions} transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Merchant</TableHead><TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.transactions.slice(0, 10).map((txn) => {
                const key = `${txn.date}-${txn.merchant_raw}-${txn.amount}`;
                return (
                  <TableRow key={key}>
                    <TableCell className="text-fg-secondary">{formatDate(txn.date)}</TableCell>
                    <TableCell className="font-medium text-fg-default">{txn.merchant_clean || txn.merchant_raw}</TableCell>
                    <TableCell><Badge variant="secondary">{txn.suggested_category || txn.category || 'Uncategorized'}</Badge></TableCell>
                    <TableCell className={`text-right font-mono ${txn.amount < 0 ? 'text-accent-ai' : 'text-accent-positive'}`}>{formatCurrency(txn.amount)}</TableCell>
                    <TableCell className="text-right">
                      {txn.confidence_score
                        ? <ConfidenceBadge score={txn.confidence_score} />
                        : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-border-color">
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <AlertCircle className="w-4 h-4" /><span>Categories are AI-suggested and can be edited after import</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} data-testid="cancel-import"><Trash2 className="w-4 h-4 mr-2" />Cancel</Button>
            <Button className="bg-accent-primary hover:bg-accent-primary/90" onClick={onImport} disabled={importing} data-testid="confirm-import">
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Import {previewData.total_transactions} Transactions
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ score }) {
  let colorClass = 'bg-fg-muted/10 text-fg-muted';
  if (score > 0.7) colorClass = 'bg-accent-positive/10 text-accent-positive';
  else if (score > 0.5) colorClass = 'bg-accent-warning/10 text-accent-warning';
  return <span className={`text-sm ${colorClass}`}>{Math.round(score * 100)}%</span>;
}

function SupportedFormatsCard() {
  const formats = [
    { name: 'Monzo CSV', desc: 'Export from Monzo app as CSV', color: 'text-accent-positive' },
    { name: 'Generic CSV', desc: 'Standard format with date, description, amount', color: 'text-accent-positive' },
    { name: 'PDF Statements', desc: 'Coming soon - PDF parsing in development', color: 'text-accent-warning' },
  ];
  return (
    <Card className="border-border-color">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Supported Formats</CardTitle>
        <CardDescription>Bank statement formats we can parse</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {formats.map((f) => (
            <div key={f.name} className="p-4 border border-border-color rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`w-5 h-5 ${f.color}`} /><span className="font-medium text-fg-default">{f.name}</span>
              </div>
              <p className="text-sm text-fg-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default UploadPage;
