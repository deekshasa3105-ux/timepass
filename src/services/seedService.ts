import { collection, getDocs, writeBatch, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { calculatePriorityScore } from '../utils/priority';
import { IssueCategory, IssueStatus } from '../types/issue';

interface DemoIssueSeed {
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
  municipality: string;
  photoUrl: string;
  upvotes: number;
  reporterName: string;
  isSpam?: boolean;
  spamReason?: string;
  spamConfidence?: number;
}

const DEMO_ISSUES: DemoIssueSeed[] = [
  {
    title: 'Severe road depression & cracked asphalt near traffic circle',
    description: 'Crater pothole causing two-wheeler skids during evening peak traffic. Depth approx 8 inches.',
    category: 'pothole',
    status: 'reported',
    latitude: 12.9345,
    longitude: 77.6212,
    address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru',
    ward: 'Ward / 151 Koramangala',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
    upvotes: 38,
    reporterName: 'Resident Association BBMP-151',
  },
  {
    title: 'High-mast streetlight panel malfunction (Total darkness)',
    description: 'Streetlights on the entire lane have been offline for 4 nights creating an unsafe corridor for female pedestrians.',
    category: 'streetlight',
    status: 'verified',
    latitude: 12.9784,
    longitude: 77.6408,
    address: '100 Feet Rd, Defence Colony, Indiranagar, Bengaluru',
    ward: 'Ward / 80 Indiranagar',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=800&auto=format&fit=crop&q=80',
    upvotes: 27,
    reporterName: 'Karthik Rao',
  },
  {
    title: 'Stormwater drain overflowing with plastic clogging',
    description: 'Monsoon drain backed up after moderate shower, dirty runoff spilling over into residential driveways.',
    category: 'drainage',
    status: 'in_progress',
    latitude: 12.9115,
    longitude: 77.6445,
    address: 'Sector 2, HSR Layout, Bengaluru',
    ward: 'Ward / 174 HSR Layout',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
    upvotes: 42,
    reporterName: 'Pooja Sharma',
  },
  {
    title: 'Broken water utility main pipeline leaking potable water',
    description: 'Continuous drinking water leakage on sidewalk for 48 hours. Thousands of liters wasting onto pavement.',
    category: 'water',
    status: 'reported',
    latitude: 12.9298,
    longitude: 77.5835,
    address: '9th Main Road, 4th Block, Jayanagar, Bengaluru',
    ward: 'Ward / 153 Jayanagar',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80',
    upvotes: 19,
    reporterName: 'Venkatesh Murthy',
  },
  {
    title: 'Damaged pedestrian footpath with exposed utility rebars',
    description: 'Concrete pavers dismantled and left uncovered. Elderly citizens unable to walk safely to bus stop.',
    category: 'footpath',
    status: 'resolved',
    latitude: 12.9698,
    longitude: 77.7499,
    address: 'ITPL Main Road, Whitefield, Bengaluru',
    ward: 'Ward / 84 Whitefield',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80',
    upvotes: 31,
    reporterName: 'Anand K.',
  },
  {
    title: 'Illegal municipal dump heap overflowing onto primary road',
    description: 'Black spot garbage piling high attracting stray dogs and cattle near nursery school entrance.',
    category: 'garbage',
    status: 'reported',
    latitude: 12.9555,
    longitude: 77.6080,
    address: 'Adugodi Main Rd, Bengaluru',
    ward: 'Ward / 147 Adugodi',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800&auto=format&fit=crop&q=80',
    upvotes: 56,
    reporterName: 'Clean Bangalore Volunteer Group',
  },
  {
    title: 'Traffic signal junction blinking yellow / malfunctioning timer',
    description: 'Signal timing stuck causing gridlock and near-miss collisions across major 4-way intersection.',
    category: 'traffic',
    status: 'in_progress',
    latitude: 12.9733,
    longitude: 77.6190,
    address: 'MG Road Junction, Halasuru, Bengaluru',
    ward: 'Ward / 111 Halasuru',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    upvotes: 64,
    reporterName: 'Commuter Network',
  },
  {
    title: 'asdfghjk lskdfj qwerpoiu123',
    description: 'zzzzz 11111 test asdfasdf mnbvcxz nothing here whatever lol',
    category: 'other',
    status: 'reported',
    latitude: 12.9550,
    longitude: 77.6100,
    address: 'Near Old Airport Rd, Domlur, Bengaluru',
    ward: 'Ward / 112 Domlur',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: '',
    upvotes: 0,
    reporterName: 'Anonymous Reporter',
    isSpam: true,
    spamReason: 'AI Shield: Text does not make any sense (incoherent keyboard mashing / gibberish non-words)',
    spamConfidence: 0.98,
  },
  {
    title: 'FREE CRYPTO BONUS VISIT WWW.WIN-COIN-FAST.XYZ EARN $5000',
    description: 'Join telegram channel @cryptorich now for instant payout guaranteed promo casino!',
    category: 'other',
    status: 'reported',
    latitude: 12.9250,
    longitude: 77.5850,
    address: 'Jayanagar 4th Block, Bengaluru',
    ward: 'Ward / 153 Jayanagar',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
    photoUrl: '',
    upvotes: 0,
    reporterName: 'Promo Bot #491',
    isSpam: true,
    spamReason: 'AI Shield: Commercial advertisement / unsolicited scam promotion',
    spamConfidence: 0.99,
  }
];

export async function seedDemoIssuesToFirestore(): Promise<{ inserted: number; message: string }> {
  try {
    const issuesRef = collection(db, 'issues');
    const existingSnap = await getDocs(issuesRef);

    if (existingSnap.size > 0) {
      return {
        inserted: 0,
        message: `Firestore already contains ${existingSnap.size} issue records. Skipped re-seeding.`,
      };
    }

    const batch = writeBatch(db);

    DEMO_ISSUES.forEach((demo) => {
      const newDocRef = doc(issuesRef);
      const { score, level } = calculatePriorityScore(demo.upvotes, demo.category, new Date(), demo.status);

      batch.set(newDocRef, {
        title: demo.title,
        description: demo.description,
        category: demo.category,
        status: demo.status,
        latitude: demo.latitude,
        longitude: demo.longitude,
        address: demo.address,
        photoUrl: demo.photoUrl,
        reportedBy: 'seed_system_officer',
        reporterName: demo.reporterName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        upvotes: demo.upvotes,
        priorityScore: score,
        ward: demo.ward,
        municipality: demo.municipality,
        isSpam: Boolean(demo.isSpam),
        ...(demo.isSpam ? {
          spamReason: demo.spamReason || 'Flagged by AI automated spam filter',
          spamConfidence: demo.spamConfidence || 0.95,
          spamFilteredAt: new Date().toISOString(),
        } : {}),
        timeline: [
          {
            status: 'reported',
            timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
            note: 'Initial citizen grievance logged with geotag',
          },
          ...(demo.status !== 'reported'
            ? [
                {
                  status: 'verified',
                  timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
                  note: 'Municipal ward inspector verified onsite',
                },
              ]
            : []),
          ...(demo.status === 'in_progress' || demo.status === 'resolved'
            ? [
                {
                  status: 'in_progress',
                  timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
                  note: 'Work crew and contractor dispatched to site',
                },
              ]
            : []),
          ...(demo.status === 'resolved'
            ? [
                {
                  status: 'resolved',
                  timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
                  note: 'Repair completed and inspected by ward engineer',
                },
              ]
            : []),
        ],
      });
    });

    await batch.commit();

    return {
      inserted: DEMO_ISSUES.length,
      message: `Successfully seeded ${DEMO_ISSUES.length} civic infrastructure reports into Firestore!`,
    };
  } catch (err: any) {
    console.error('Seed error:', err);
    throw err;
  }
}
