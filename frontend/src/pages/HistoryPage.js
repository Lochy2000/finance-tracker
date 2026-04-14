import React, { useState, useEffect, useCallback } from 'react';
import { filesApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { FileText, Trash2, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const STATUS_STYLES = {
  imported: 'bg-accent-positive/10 text-accent-positive border-accent-positive/30',
  parsed: 'bg-accent-warning/10 text-accent-warning border-accent-warning/30',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
  pending: 'bg-fg-muted/10 text-fg-muted border-fg-muted/30',
  parsing: 'bg-accent-primary/10 text-accent-primary border-accent-primary/30',
};

export function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await filesApi.list(0, 100);
      setFiles(response.data.files);
      setTotal(response.data.total);
    } catch {
      toast.error('Failed to load upload history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleDelete = useCallback(async (fileId) => {
    try {
      await filesApi.delete(fileId);
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
      setTotal((prev) => prev - 1);
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="history-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Upload History</h1>
          <p className="text-fg-secondary mt-1">{total} file{total !== 1 ? 's' : ''} uploaded</p>
        </div>
        <Button className="bg-accent-primary hover:bg-accent-primary/90" onClick={() => navigate('/upload')} data-testid="upload-new-btn">
          <Upload className="w-4 h-4 mr-2" />Upload New
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={`hs-${i}`} className="h-20" />)}</div>
      ) : files.length === 0 ? (
        <Card className="border-border-color">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-fg-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-fg-default mb-2">No uploads yet</h3>
            <p className="text-fg-muted mb-4">Upload a bank statement to get started</p>
            <Button className="bg-accent-primary hover:bg-accent-primary/90" onClick={() => navigate('/upload')}>
              <Upload className="w-4 h-4 mr-2" />Upload Statement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border-color">
          <CardContent className="p-0">
            <div className="divide-y divide-border-color">
              {files.map((file) => (
                <FileRow key={file.file_id} file={file} onDelete={handleDelete} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FileRow({ file, onDelete }) {
  const statusStyle = STATUS_STYLES[file.status] || STATUS_STYLES.pending;
  return (
    <div className="flex items-center justify-between p-4 hover:bg-bg-subtle/50 transition-colors group">
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-2 rounded-lg bg-bg-subtle shrink-0">
          <FileText className="w-5 h-5 text-fg-secondary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-fg-default truncate">{file.filename}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-fg-muted">
            <span>{formatDate(file.uploaded_at)}</span>
            {file.bank_name && <span>{file.bank_name}</span>}
            <span>{(file.file_size / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {file.transaction_count != null && (
          <span className="text-sm text-fg-secondary hidden sm:block">{file.transaction_count} txns</span>
        )}
        {file.error && (
          <span className="text-xs text-destructive hidden md:flex items-center gap-1"><AlertCircle className="w-3 h-3" />{file.error.slice(0, 40)}</span>
        )}
        <Badge variant="outline" className={statusStyle}>{file.status}</Badge>
        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(file.file_id)} data-testid={`delete-file-${file.file_id}`}>
          <Trash2 className="w-4 h-4 text-fg-muted" />
        </Button>
      </div>
    </div>
  );
}

export default HistoryPage;
