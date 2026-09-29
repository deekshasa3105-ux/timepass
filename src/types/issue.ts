export type IssueCategory =
  | 'streetlight'
  | 'pothole'
  | 'garbage'
  | 'drainage'
  | 'water'
  | 'footpath'
  | 'traffic'
  | 'other';

export type IssueStatus = 'reported' | 'verified' | 'in_progress' | 'resolved';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface StatusTimelineEvent {
  status: IssueStatus;
  timestamp: string; // ISO string or formatted date
  note?: string;
  updatedBy?: string;
}

export interface RenovationProposal {
  id: string;
  issueId: string;
  companyId: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  estimatedDays: number;
  estimatedCost?: string;
  scopeOfWork: string;
  submittedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  appointedDeadline?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  address: string;
  photoUrl: string;
  reportedBy: string;
  reporterName?: string;
  reporterPhotoUrl?: string;
  reporterEmail?: string;
  isGoogleVerified?: boolean;
  createdAt: any; // Firestore Timestamp or string
  updatedAt: any;
  upvotes: number;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  ward: string;
  municipality: string;
  timeline?: StatusTimelineEvent[];
  proposals?: RenovationProposal[];
  appointedCompanyId?: string;
  appointedCompanyName?: string;
  appointedDeadline?: string;
  renovationStatus?: 'open_for_bids' | 'contractor_appointed' | 'work_in_progress' | 'completed';
  isSpam?: boolean;
  spamReason?: string;
  spamConfidence?: number;
  spamFilteredAt?: any;
  markedNotSpamBy?: string;
  markedNotSpamAt?: any;
}

export interface ActivityItem {
  id: string;
  issueId: string;
  issueTitle?: string;
  type: 'reported' | 'upvoted' | 'status_change' | 'resolved' | 'status_update';
  detail: string;
  location?: string;
  timestamp: any;
}

export interface IssueFilterState {
  category: string;
  status: string;
  priority: string;
  timeRange: 'all' | '24h' | '7d' | '30d';
  searchQuery: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
  municipality: string;
}
