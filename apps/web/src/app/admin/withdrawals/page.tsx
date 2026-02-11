'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { formatNumber, formatRelativeTime, getStatusColor, shortenAddress } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  X,
  ExternalLink,
  Search,
  Filter,
  Eye,
  Banknote,
} from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SENT', label: 'Sent' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
];

export default function AdminWithdrawalsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [manualProofUrl, setManualProofUrl] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showManualPayModal, setShowManualPayModal] = useState(false);

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn: () => api.adminGetWithdrawals(accessToken!, { status: statusFilter || undefined }),
    enabled: !!accessToken,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.adminApproveWithdrawal(accessToken!, id, notes),
    onSuccess: () => {
      toast({ title: 'Withdrawal approved', description: 'Payout job has been queued', variant: 'success' as any });
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setShowReviewModal(false);
      setSelectedWithdrawal(null);
      setAdminNotes('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.adminRejectWithdrawal(accessToken!, id, notes),
    onSuccess: () => {
      toast({ title: 'Withdrawal rejected', description: 'Funds have been returned to user', variant: 'success' as any });
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setShowReviewModal(false);
      setSelectedWithdrawal(null);
      setAdminNotes('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, proofUrl, notes }: { id: string; proofUrl?: string; notes: string }) =>
      api.adminMarkPaidManually(accessToken!, id, proofUrl, notes),
    onSuccess: () => {
      toast({ title: 'Marked as paid', description: 'Withdrawal has been marked as manually paid', variant: 'success' as any });
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setShowManualPayModal(false);
      setSelectedWithdrawal(null);
      setAdminNotes('');
      setManualProofUrl('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openReviewModal = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setAdminNotes('');
    setShowReviewModal(true);
  };

  const openManualPayModal = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setAdminNotes('');
    setManualProofUrl('');
    setShowManualPayModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Withdrawal Queue</h1>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <p className="text-sm">
            <strong>Important:</strong> Review each withdrawal carefully. Check fraud indicators, 
            user history, and destination address before approving. Approved withdrawals will 
            trigger automatic on-chain payouts.
          </p>
        </CardContent>
      </Card>

      {/* Withdrawals Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Destination</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Fraud Score</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {withdrawals?.items?.map((w: any) => (
                    <tr key={w.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{w.user?.email}</p>
                          <p className="text-xs text-muted-foreground">
                            KYC: {w.user?.kycStatus || 'N/A'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {formatNumber(w.amount)} {w.asset?.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Net: {formatNumber(w.netAmount)} {w.asset?.symbol}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-xs">{shortenAddress(w.destinationAddress, 6)}</code>
                          <a
                            href={`https://etherscan.io/address/${w.destinationAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          w.fraudScore >= 50 ? 'bg-red-500/10 text-red-500' :
                          w.fraudScore >= 25 ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-green-500/10 text-green-500'
                        }`}>
                          <AlertTriangle className="h-3 w-3" />
                          {w.fraudScore}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(w.status)}`}>
                          {w.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatRelativeTime(w.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {w.status === 'PENDING_REVIEW' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openReviewModal(w)}
                              >
                                Review
                              </Button>
                            </>
                          )}
                          {(w.status === 'APPROVED' || w.status === 'FAILED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openManualPayModal(w)}
                            >
                              <Banknote className="h-4 w-4 mr-1" />
                              Manual Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedWithdrawal(w)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!withdrawals?.items?.length && (
                <div className="p-8 text-center text-muted-foreground">
                  No withdrawals found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      {showReviewModal && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Review Withdrawal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">User</p>
                  <p className="font-medium">{selectedWithdrawal.user?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {formatNumber(selectedWithdrawal.amount)} {selectedWithdrawal.asset?.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Destination</p>
                  <code className="text-xs">{shortenAddress(selectedWithdrawal.destinationAddress, 8)}</code>
                </div>
                <div>
                  <p className="text-muted-foreground">Fraud Score</p>
                  <p className={`font-medium ${selectedWithdrawal.fraudScore >= 50 ? 'text-red-500' : ''}`}>
                    {selectedWithdrawal.fraudScore}/100
                  </p>
                </div>
              </div>

              {selectedWithdrawal.fraudIndicators?.length > 0 && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm font-medium text-yellow-500 mb-2">Fraud Indicators</p>
                  <ul className="text-xs space-y-1">
                    {selectedWithdrawal.fraudIndicators.map((ind: any, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" />
                        [{ind.severity}] {ind.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedWithdrawal.userNotes && (
                <div>
                  <p className="text-sm text-muted-foreground">User Notes</p>
                  <p className="text-sm">{selectedWithdrawal.userNotes}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Input
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional notes for audit log"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate({ id: selectedWithdrawal.id, notes: adminNotes || 'Rejected by admin' })}
                  loading={rejectMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ id: selectedWithdrawal.id, notes: adminNotes })}
                  loading={approveMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve & Queue Payout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Pay Modal */}
      {showManualPayModal && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Mark as Paid Manually</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use this if you have paid the user outside of the automated system (e.g., direct bank transfer).
              </p>

              <div className="space-y-2">
                <Label>Proof URL (optional)</Label>
                <Input
                  value={manualProofUrl}
                  onChange={(e) => setManualProofUrl(e.target.value)}
                  placeholder="https://explorer.io/tx/..."
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (required)</Label>
                <Input
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Description of manual payment"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowManualPayModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => markPaidMutation.mutate({
                    id: selectedWithdrawal.id,
                    proofUrl: manualProofUrl,
                    notes: adminNotes,
                  })}
                  loading={markPaidMutation.isPending}
                  disabled={!adminNotes}
                >
                  <Banknote className="h-4 w-4 mr-1" />
                  Mark as Paid
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
