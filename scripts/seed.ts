import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, serverTimestamp, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCJLF9Jz25kjFcNBwpQ2NQ3jj7dv4VhBxM",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "fabled-operation-114dk.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "fabled-operation-114dk",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "fabled-operation-114dk.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "310478185877",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:310478185877:web:71a600049a820748a2829c",
};

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-5a0ba519-aa36-4715-b3e6-103a76169b21";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, databaseId);

const DEMO_ISSUES = [
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
  }
];

async function seed() {
  console.log("Checking Firestore issues...");
  const issuesRef = collection(db, 'issues');
  const snap = await getDocs(issuesRef);
  
  if (snap.size > 0) {
    console.log(`Firestore already has ${snap.size} issues.`);
    process.exit(0);
  }

  console.log(`Seeding ${DEMO_ISSUES.length} issues into Firestore database [${databaseId}]...`);
  const batch = writeBatch(db);

  DEMO_ISSUES.forEach((demo) => {
    const docRef = doc(issuesRef);
    const score = (demo.upvotes * 6) + 25 + 15;
    batch.set(docRef, {
      ...demo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      priorityScore: score,
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          note: 'Initial citizen grievance logged with geotag',
        },
        ...(demo.status !== 'reported' ? [{
          status: 'verified',
          timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          note: 'Municipal ward inspector verified onsite',
        }] : []),
        ...(demo.status === 'in_progress' || demo.status === 'resolved' ? [{
          status: 'in_progress',
          timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
          note: 'Work crew and contractor dispatched to site',
        }] : []),
        ...(demo.status === 'resolved' ? [{
          status: 'resolved',
          timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          note: 'Repair completed and inspected by ward engineer',
        }] : []),
      ]
    });
  });

  await batch.commit();
  console.log("Seeding completed successfully!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
