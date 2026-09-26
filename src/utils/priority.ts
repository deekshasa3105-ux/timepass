import { PriorityLevel, IssueCategory, IssueStatus } from '../types/issue';

/**
 * Calculates a transparent community priority score.
 * Formula:
 * priorityScore = (upvotes * 5) + recencyScore + severityWeight
 * 
 * Severity Weight based on category risk to public safety:
 * - pothole / road hazard: 25
 * - drainage / water contamination: 20
 * - streetlight / darkness: 18
 * - traffic signal malfunction: 30
 * - garbage: 15
 * - footpath: 12
 * - other: 10
 */

const CATEGORY_SEVERITY: Record<IssueCategory, number> = {
  traffic: 30,
  pothole: 25,
  drainage: 20,
  water: 20,
  streetlight: 18,
  garbage: 15,
  footpath: 12,
  other: 10,
};

export function calculatePriorityScore(
  upvotes: number,
  category: IssueCategory,
  createdAt: any,
  status: IssueStatus
): { score: number; level: PriorityLevel } {
  // If resolved, priority naturally reduces
  if (status === 'resolved') {
    return { score: 5, level: 'LOW' };
  }

  const categoryWeight = CATEGORY_SEVERITY[category] || 15;
  const upvoteWeight = (upvotes || 0) * 6;

  // Recency bonus (issues in last 24h get 25pts, 3d get 15pts, older get 5pts)
  let recencyBonus = 10;
  try {
    const createdDate = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
    const hoursOld = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
    if (hoursOld <= 24) recencyBonus = 25;
    else if (hoursOld <= 72) recencyBonus = 15;
    else if (hoursOld <= 168) recencyBonus = 8;
    else recencyBonus = 2;
  } catch {
    recencyBonus = 10;
  }

  const totalScore = categoryWeight + upvoteWeight + recencyBonus;

  let level: PriorityLevel = 'LOW';
  if (totalScore >= 75) {
    level = 'CRITICAL';
  } else if (totalScore >= 45) {
    level = 'HIGH';
  } else if (totalScore >= 25) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  return { score: totalScore, level };
}

export function getPriorityBadgeColor(level: PriorityLevel) {
  switch (level) {
    case 'CRITICAL':
      return {
        bg: 'bg-red-500/15',
        text: 'text-red-400',
        border: 'border-red-500/30',
        dot: 'bg-red-500',
        hex: '#ef4444'
      };
    case 'HIGH':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-500',
        hex: '#f59e0b'
      };
    case 'MEDIUM':
      return {
        bg: 'bg-yellow-500/15',
        text: 'text-yellow-300',
        border: 'border-yellow-500/30',
        dot: 'bg-yellow-400',
        hex: '#eab308'
      };
    case 'LOW':
    default:
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
        hex: '#10b981'
      };
  }
}

export function getCategoryMeta(category: IssueCategory) {
  switch (category) {
    case 'pothole':
      return { label: 'Road / Pothole', icon: '🚧', color: 'from-amber-600 to-orange-500' };
    case 'streetlight':
      return { label: 'Streetlight', icon: '💡', color: 'from-yellow-500 to-amber-400' };
    case 'garbage':
      return { label: 'Garbage accumulation', icon: '🗑', color: 'from-emerald-600 to-teal-500' };
    case 'drainage':
      return { label: 'Blocked drainage', icon: '🌊', color: 'from-cyan-600 to-blue-500' };
    case 'water':
      return { label: 'Water leakage', icon: '💧', color: 'from-blue-600 to-sky-400' };
    case 'footpath':
      return { label: 'Damaged footpath', icon: '🚶', color: 'from-purple-600 to-indigo-500' };
    case 'traffic':
      return { label: 'Traffic signal issue', icon: '🚦', color: 'from-rose-600 to-red-500' };
    case 'other':
    default:
      return { label: 'Other infrastructure', icon: '⚠', color: 'from-slate-600 to-gray-500' };
  }
}

export function getStatusMeta(status: IssueStatus) {
  switch (status) {
    case 'reported':
      return { label: 'Reported', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30', dot: 'bg-sky-400' };
    case 'verified':
      return { label: 'Verified', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' };
    case 'in_progress':
      return { label: 'In Progress', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', dot: 'bg-purple-400' };
    case 'resolved':
      return { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' };
  }
}
