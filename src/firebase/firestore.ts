import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  setDoc,
} from 'firebase/firestore';
import { db, ensureAuth } from './config';
import { CivicIssue, ActivityItem, IssueCategory, IssueStatus, RenovationProposal } from '../types/issue';
import { calculatePriorityScore } from '../utils/priority';

const ISSUES_COLLECTION = 'issues';
const ACTIVITIES_COLLECTION = 'activities';

export function getLocalReportIds(): string[] {
  try {
    const raw = localStorage.getItem('civicpulse_my_report_ids');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Real-time listener for all issues in the Firestore database.
 * Directly listens to the collection and sorts in-memory by newest first,
 * ensuring all documents (even those without indexes or pending server timestamps)
 * are immediately and reliably received on any device anywhere.
 */
export function subscribeToIssues(
  callback: (issues: CivicIssue[]) => void,
  onError?: (error: Error) => void
) {
  const issuesRef = collection(db, ISSUES_COLLECTION);

  return onSnapshot(
    issuesRef,
    (snapshot) => {
      const issues: CivicIssue[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data({ serverTimestamps: 'estimate' });
        const category = (data.category || 'other') as IssueCategory;
        const status = (data.status || 'reported') as IssueStatus;
        const upvotes = Number(data.upvotes) || 0;

        let createdAtDate = new Date();
        if (data.createdAt?.toDate) {
          createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt?.seconds) {
          createdAtDate = new Date(data.createdAt.seconds * 1000);
        } else if (data.createdAt) {
          const parsed = new Date(data.createdAt);
          if (!isNaN(parsed.getTime())) createdAtDate = parsed;
        }

        let updatedAtDate = createdAtDate;
        if (data.updatedAt?.toDate) {
          updatedAtDate = data.updatedAt.toDate();
        } else if (data.updatedAt?.seconds) {
          updatedAtDate = new Date(data.updatedAt.seconds * 1000);
        } else if (data.updatedAt) {
          const parsed = new Date(data.updatedAt);
          if (!isNaN(parsed.getTime())) updatedAtDate = parsed;
        }

        const { score, level } = calculatePriorityScore(upvotes, category, createdAtDate, status);

        return {
          id: docSnap.id,
          title: data.title || 'Untitled Issue',
          description: data.description || '',
          category,
          status,
          priorityScore: score,
          priorityLevel: level,
          latitude: Number(data.latitude) || 12.9716,
          longitude: Number(data.longitude) || 77.5946,
          address: data.address || 'Address unlisted',
          photoUrl: data.photoUrl || undefined,
          upvotes,
          reportedBy: data.reportedBy || 'citizen',
          reporterName: data.reporterName || 'Citizen Resident',
          reporterPhotoUrl: data.reporterPhotoUrl || undefined,
          reporterEmail: data.reporterEmail || undefined,
          isGoogleVerified: Boolean(data.isGoogleVerified),
          createdAt: createdAtDate,
          updatedAt: updatedAtDate,
          ward: data.ward || 'General',
          municipality: data.municipality || 'City Council',
          timeline: Array.isArray(data.timeline) ? data.timeline : [],
          proposals: Array.isArray(data.proposals) ? data.proposals : [],
          appointedCompanyId: data.appointedCompanyId || undefined,
          appointedCompanyName: data.appointedCompanyName || undefined,
          appointedDeadline: data.appointedDeadline || undefined,
          renovationStatus: data.renovationStatus || undefined,
        };
      });

      // Sort by newest first
      issues.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      });

      callback(issues);
    },
    (err) => {
      console.warn('Realtime issues listener notice:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Directly queries all issues once from Firestore (useful for manual refresh or diagnostics)
 */
export async function fetchIssuesDirectly(): Promise<CivicIssue[]> {
  const issuesRef = collection(db, ISSUES_COLLECTION);
  const snapshot = await getDocs(issuesRef);
  const issues: CivicIssue[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data({ serverTimestamps: 'estimate' });
    const category = (data.category || 'other') as IssueCategory;
    const status = (data.status || 'reported') as IssueStatus;
    const upvotes = Number(data.upvotes) || 0;

    let createdAtDate = new Date();
    if (data.createdAt?.toDate) {
      createdAtDate = data.createdAt.toDate();
    } else if (data.createdAt?.seconds) {
      createdAtDate = new Date(data.createdAt.seconds * 1000);
    } else if (data.createdAt) {
      const parsed = new Date(data.createdAt);
      if (!isNaN(parsed.getTime())) createdAtDate = parsed;
    }

    const { score, level } = calculatePriorityScore(upvotes, category, createdAtDate, status);

    return {
      id: docSnap.id,
      title: data.title || 'Untitled Issue',
      description: data.description || '',
      category,
      status,
      priorityScore: score,
      priorityLevel: level,
      latitude: Number(data.latitude) || 12.9716,
      longitude: Number(data.longitude) || 77.5946,
      address: data.address || 'Address unlisted',
      photoUrl: data.photoUrl || undefined,
      upvotes,
      reportedBy: data.reportedBy || 'citizen',
      reporterName: data.reporterName || 'Citizen Resident',
      reporterPhotoUrl: data.reporterPhotoUrl || undefined,
      reporterEmail: data.reporterEmail || undefined,
      isGoogleVerified: Boolean(data.isGoogleVerified),
      createdAt: createdAtDate,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : createdAtDate,
      ward: data.ward || 'General',
      municipality: data.municipality || 'City Council',
      timeline: Array.isArray(data.timeline) ? data.timeline : [],
      proposals: Array.isArray(data.proposals) ? data.proposals : [],
      appointedCompanyId: data.appointedCompanyId || undefined,
      appointedCompanyName: data.appointedCompanyName || undefined,
      appointedDeadline: data.appointedDeadline || undefined,
      renovationStatus: data.renovationStatus || undefined,
    };
  });

  issues.sort((a, b) => {
    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return timeB - timeA;
  });

  return issues;
}

/**
 * Real-time listener for recent activity feed
 */
export function subscribeToActivities(callback: (activities: ActivityItem[]) => void) {
  const activitiesRef = collection(db, ACTIVITIES_COLLECTION);
  const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(15));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ActivityItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ActivityItem, 'id'>),
      }));
      callback(items);
    },
    (err) => {
      console.warn('Activities listener notice:', err);
    }
  );
}

/**
 * Log an activity entry to Firestore (fire-and-forget, never throws or hangs caller)
 */
function logActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'>) {
  try {
    addDoc(collection(db, ACTIVITIES_COLLECTION), {
      ...activity,
      timestamp: serverTimestamp(),
    }).catch((e) => {
      console.warn('Could not log activity:', e);
    });
  } catch (e) {
    console.warn('Could not log activity:', e);
  }
}

/**
 * Submits a new civic issue to Firestore.
 * Performs deep sanitation, commits directly to Cloud Firestore, and awaits confirmation.
 */
export async function createIssue(data: {
  title: string;
  description: string;
  category: IssueCategory;
  latitude: number;
  longitude: number;
  address: string;
  photoUrl: string;
  ward: string;
  municipality: string;
  reporterName?: string;
  reporterPhotoUrl?: string;
  reporterEmail?: string;
  isGoogleVerified?: boolean;
}): Promise<string> {
  const userId = await ensureAuth();
  const now = new Date();

  const { score } = calculatePriorityScore(0, data.category, now, 'reported');

  // Generate document reference synchronously with Firestore unique ID
  const docRef = doc(collection(db, ISSUES_COLLECTION));
  const newIssueId = docRef.id;

  const rawDoc: Record<string, any> = {
    title: (data.title || '').trim(),
    description: (data.description || '').trim(),
    category: data.category || 'other',
    status: 'reported',
    latitude: Number(data.latitude) || 12.9716,
    longitude: Number(data.longitude) || 77.5946,
    address: (data.address || '').trim() || 'Address unlisted',
    photoUrl: data.photoUrl || '',
    reportedBy: userId,
    reporterName: (data.reporterName || 'Citizen Resident').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    upvotes: 0,
    priorityScore: score,
    ward: data.ward || 'General',
    municipality: data.municipality || 'Municipal Council',
    isGoogleVerified: Boolean(data.isGoogleVerified),
    timeline: [
      {
        status: 'reported',
        timestamp: new Date().toISOString(),
        note: 'Issue reported and mapped by community member',
      },
    ],
  };

  if (data.reporterPhotoUrl) {
    rawDoc.reporterPhotoUrl = data.reporterPhotoUrl;
  }
  if (data.reporterEmail) {
    rawDoc.reporterEmail = data.reporterEmail;
  }

  // Remove any remaining undefined or null fields
  const cleanDoc: Record<string, any> = {};
  for (const [key, val] of Object.entries(rawDoc)) {
    if (val !== undefined && val !== null) {
      cleanDoc[key] = val;
    }
  }

  // Directly await setDoc to guarantee document persistence in Cloud Firestore!
  await setDoc(docRef, cleanDoc);

  // Track locally so user can immediately see it under My Reports regardless of auth changes
  try {
    const stored = JSON.parse(localStorage.getItem('civicpulse_my_report_ids') || '[]');
    if (!stored.includes(newIssueId)) {
      stored.push(newIssueId);
      localStorage.setItem('civicpulse_my_report_ids', JSON.stringify(stored));
    }
  } catch {
    // non-fatal
  }

  // Broadcast to activity stream non-blockingly
  logActivity({
    issueId: newIssueId,
    issueTitle: data.title,
    type: 'reported',
    detail: `New ${data.category} issue reported`,
    location: data.address.split(',')[0] || data.ward,
  });

  return newIssueId;
}

/**
 * Checks if current user/device has already upvoted this issue
 */
export async function hasUserVoted(issueId: string): Promise<boolean> {
  const userId = await ensureAuth();
  const voteDoc = doc(db, ISSUES_COLLECTION, issueId, 'votes', userId);
  const snap = await getDoc(voteDoc);
  return snap.exists();
}

/**
 * Upvotes an issue with duplicate vote prevention per user/device
 */
export async function upvoteIssue(issueId: string): Promise<boolean> {
  const userId = await ensureAuth();
  const voteDocRef = doc(db, ISSUES_COLLECTION, issueId, 'votes', userId);

  const existingVote = await getDoc(voteDocRef);
  if (existingVote.exists()) {
    return false; // Already voted
  }

  // Record user vote
  await setDoc(voteDocRef, {
    votedAt: serverTimestamp(),
    userId,
  });

  // Increment upvote count on issue document
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  await updateDoc(issueRef, {
    upvotes: increment(1),
    updatedAt: serverTimestamp(),
  });

  // Log activity non-blockingly
  logActivity({
    issueId,
    type: 'upvoted',
    detail: 'Community member verified and upvoted this hazard',
  });

  return true;
}

/**
 * Updates status of an issue (e.g., reported -> in_progress -> resolved)
 */
export async function updateIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  note?: string,
  updatedBy?: string
): Promise<void> {
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);

  const actor = updatedBy || 'Municipal Authority';
  const timelineEntry = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    note: note || `Status updated to ${newStatus.replace('_', ' ')}`,
    updatedBy: actor,
  };

  await updateDoc(issueRef, {
    status: newStatus,
    updatedAt: serverTimestamp(),
    timeline: arrayUnion(timelineEntry),
  });

  logActivity({
    issueId,
    type: newStatus === 'resolved' ? 'resolved' : 'status_update',
    detail: `Hazard status updated to: ${newStatus.replace('_', ' ').toUpperCase()} by ${actor}`,
  });
}

/**
 * Submits a company renovation proposal for a civic incident
 */
export async function submitRenovationProposal(
  issueId: string,
  data: {
    companyId: string;
    companyName: string;
    contactEmail: string;
    contactPhone?: string;
    estimatedDays: number;
    estimatedCost?: string;
    scopeOfWork: string;
  }
): Promise<RenovationProposal> {
  const proposalId = 'prop_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const newProposal: RenovationProposal = {
    id: proposalId,
    issueId,
    companyId: data.companyId,
    companyName: data.companyName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone || '',
    estimatedDays: data.estimatedDays,
    estimatedCost: data.estimatedCost || '',
    scopeOfWork: data.scopeOfWork,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  };

  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  const snap = await getDoc(issueRef);
  if (snap.exists()) {
    const existing = snap.data();
    const existingProps: RenovationProposal[] = Array.isArray(existing.proposals) ? existing.proposals : [];
    // If company already had a proposal, replace it, otherwise append
    const updatedProps = existingProps.filter((p) => p.companyId !== data.companyId && p.id !== proposalId);
    updatedProps.push(newProposal);

    await updateDoc(issueRef, {
      proposals: updatedProps,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(issueRef, {
      proposals: arrayUnion(newProposal),
      updatedAt: serverTimestamp(),
    });
  }

  // Also write to subcollection for direct record-keeping
  try {
    const propSubRef = doc(db, ISSUES_COLLECTION, issueId, 'proposals', proposalId);
    await setDoc(propSubRef, {
      ...newProposal,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Subcollection proposal save warning:', e);
  }

  logActivity({
    issueId,
    type: 'status_update',
    detail: `Company "${data.companyName}" submitted renovation proposal (${data.estimatedDays} days estimate)`,
  });

  return newProposal;
}

/**
 * Municipal Authority selects/appoints a company proposal and assigns completion deadline
 */
export async function appointCompanyProposal(
  issueId: string,
  proposalId: string,
  companyId: string,
  companyName: string,
  deadline: string,
  municipalOfficer: string
): Promise<void> {
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  const snap = await getDoc(issueRef);

  let updatedProps: RenovationProposal[] = [];
  if (snap.exists()) {
    const existing = snap.data();
    const existingProps: RenovationProposal[] = Array.isArray(existing.proposals) ? existing.proposals : [];
    updatedProps = existingProps.map((p) => {
      if (p.id === proposalId || p.companyId === companyId) {
        return {
          ...p,
          status: 'accepted' as const,
          appointedDeadline: deadline,
          reviewedBy: municipalOfficer,
          reviewedAt: new Date().toISOString(),
        };
      }
      return {
        ...p,
        status: p.status === 'accepted' ? ('rejected' as const) : p.status,
      };
    });
  }

  const timelineEntry = {
    status: 'in_progress' as IssueStatus,
    timestamp: new Date().toISOString(),
    note: `Municipal Authority appointed contractor "${companyName}" for renovation. Completion deadline: ${deadline}`,
    updatedBy: municipalOfficer,
  };

  await updateDoc(issueRef, {
    status: 'in_progress',
    appointedCompanyId: companyId,
    appointedCompanyName: companyName,
    appointedDeadline: deadline,
    renovationStatus: 'contractor_appointed',
    proposals: updatedProps,
    updatedAt: serverTimestamp(),
    timeline: arrayUnion(timelineEntry),
  });

  // Also update subcollection doc
  try {
    const propSubRef = doc(db, ISSUES_COLLECTION, issueId, 'proposals', proposalId);
    await updateDoc(propSubRef, {
      status: 'accepted',
      appointedDeadline: deadline,
      reviewedBy: municipalOfficer,
      reviewedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Subcollection proposal update warning:', e);
  }

  logActivity({
    issueId,
    type: 'status_update',
    detail: `Municipal Authority appointed "${companyName}" with deadline: ${deadline}`,
  });
}

/**
 * Seeds demo civic issues for demonstration if database is empty
 */
export async function seedDemoIssuesToFirestore(): Promise<{ count: number; message: string }> {
  const issuesRef = collection(db, ISSUES_COLLECTION);
  const snap = await getDocs(query(issuesRef, limit(1)));

  if (!snap.empty) {
    return { count: 0, message: 'Firestore already contains civic issues' };
  }

  const demoIssues = [
    {
      title: 'Deep Hazardous Pothole on Outer Ring Road',
      description: 'Severe 8-inch depression in middle lane causing sudden swerving during rush hour. Multiple near misses reported.',
      category: 'pothole',
      status: 'reported',
      latitude: 12.9352,
      longitude: 77.6245,
      address: 'Near Bellandur Flyover, Outer Ring Road, Bengaluru',
      photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      upvotes: 24,
      priorityScore: 78,
      ward: 'Ward 150 - Bellandur',
      municipality: 'BBMP Mahadevapura',
      reporterName: 'Kavita Sundaram',
      createdAt: new Date(Date.now() - 3600000 * 24 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 24 * 2),
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
          note: 'Issue reported by commuter',
        },
      ],
    },
    {
      title: 'Broken Streetlight Array along 100 Feet Road',
      description: 'Five consecutive sodium streetlights dark for 4 consecutive nights. Low visibility pedestrian hazard.',
      category: 'streetlight',
      status: 'in_progress',
      latitude: 12.9784,
      longitude: 77.6408,
      address: '100ft Road, Indiranagar 1st Stage, Bengaluru',
      photoUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80',
      upvotes: 18,
      priorityScore: 65,
      ward: 'Ward 82 - Hoysala Nagar',
      municipality: 'BBMP East',
      reporterName: 'Rahul Verma',
      createdAt: new Date(Date.now() - 3600000 * 24 * 4),
      updatedAt: new Date(Date.now() - 3600000 * 12),
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
          note: 'Reported by local RWA',
        },
        {
          status: 'in_progress',
          timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
          note: 'BESCOM technician crew dispatched for junction box repair',
        },
      ],
    },
    {
      title: 'Overflowing Municipal Garbage Dump near School',
      description: 'Commercial waste piling onto sidewalk outside primary school gate. Poses direct sanitary and health risk.',
      category: 'garbage',
      status: 'reported',
      latitude: 12.9279,
      longitude: 77.6271,
      address: 'Koramangala 4th Block, 80ft Road Junction',
      photoUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80',
      upvotes: 31,
      priorityScore: 84,
      ward: 'Ward 151 - Koramangala',
      municipality: 'BBMP South',
      reporterName: 'Priya N.',
      createdAt: new Date(Date.now() - 3600000 * 16),
      updatedAt: new Date(Date.now() - 3600000 * 16),
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(Date.now() - 3600000 * 16).toISOString(),
          note: 'Escalated by school administrator',
        },
      ],
    },
    {
      title: 'Open Stormwater Drain Silt Chamber',
      description: 'Damaged concrete slab leaving open 6-foot drain channel. High risk in rain for cyclists and two-wheelers.',
      category: 'drainage',
      status: 'reported',
      latitude: 12.9698,
      longitude: 77.7499,
      address: 'ITPL Main Road, Whitefield',
      photoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&w=800&q=80',
      upvotes: 42,
      priorityScore: 92,
      ward: 'Ward 84 - Hagadur',
      municipality: 'BBMP Mahadevapura',
      reporterName: 'Anand K.',
      createdAt: new Date(Date.now() - 3600000 * 30),
      updatedAt: new Date(Date.now() - 3600000 * 30),
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(Date.now() - 3600000 * 30).toISOString(),
          note: 'Marked as urgent high-impact safety hazard',
        },
      ],
    },
    {
      title: 'Underground Water Pipeline Main Leakage',
      description: 'Potable water spraying onto carriageway, eroding road sub-base and flooding sidewalk.',
      category: 'water',
      status: 'resolved',
      latitude: 12.9165,
      longitude: 77.6101,
      address: '9th Main Road, BTM Layout 2nd Stage',
      photoUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
      upvotes: 15,
      priorityScore: 30,
      ward: 'Ward 176 - BTM Layout',
      municipality: 'BWSSB South Division',
      reporterName: 'Manish D.',
      createdAt: new Date(Date.now() - 3600000 * 24 * 6),
      updatedAt: new Date(Date.now() - 3600000 * 24 * 1),
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(Date.now() - 3600000 * 24 * 6).toISOString(),
          note: 'Reported by local resident',
        },
        {
          status: 'in_progress',
          timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          note: 'BWSSB pipeline crew replaced damaged valve section',
        },
        {
          status: 'resolved',
          timestamp: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
          note: 'Leak stopped and asphalt patched',
        },
      ],
    },
  ];

  for (const issue of demoIssues) {
    await addDoc(collection(db, ISSUES_COLLECTION), issue);
  }

  return { count: demoIssues.length, message: `Successfully seeded ${demoIssues.length} live civic issues` };
}
