import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: string | number, decimals: number = 4): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCurrency(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercentage(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  
  return `${num.toFixed(decimals)}%`;
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Deposit statuses
    AWAITING: 'bg-yellow-500/10 text-yellow-500',
    CONFIRMING: 'bg-blue-500/10 text-blue-500',
    CONFIRMED: 'bg-green-500/10 text-green-500',
    
    // Withdrawal statuses
    PENDING_REVIEW: 'bg-yellow-500/10 text-yellow-500',
    APPROVED: 'bg-blue-500/10 text-blue-500',
    REJECTED: 'bg-red-500/10 text-red-500',
    PROCESSING: 'bg-blue-500/10 text-blue-500',
    SENT: 'bg-indigo-500/10 text-indigo-500',
    COMPLETED: 'bg-green-500/10 text-green-500',
    PAID_MANUALLY: 'bg-green-500/10 text-green-500',
    FAILED: 'bg-red-500/10 text-red-500',
    
    // Stake statuses
    ACTIVE: 'bg-green-500/10 text-green-500',
    UNSTAKING: 'bg-yellow-500/10 text-yellow-500',
    CANCELLED: 'bg-gray-500/10 text-gray-500',
  };

  return statusColors[status] || 'bg-gray-500/10 text-gray-500';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
