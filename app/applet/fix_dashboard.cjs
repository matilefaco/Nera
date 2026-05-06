const fs = require('fs');

let c = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// 1. Add import
if (!c.includes('useDashboardMetrics')) {
  c = c.replace(/import \{ DashboardSkeleton \} from '\.\.\/components\/ui\/DashboardSkeleton';/, "import { DashboardSkeleton } from '../components/ui/DashboardSkeleton';\nimport { useDashboardMetrics } from '../hooks/useDashboardMetrics';");
}

// 2. Remove states
c = c.replace(/  const \[monthlyRevenue, setMonthlyRevenue\] = useState\(0\);\n/g, '');
c = c.replace(/  const \[prevMonthlyRevenue, setPrevMonthlyRevenue\] = useState\(0\);\n/g, '');
c = c.replace(/  const \[returningThisWeek, setReturningThisWeek\] = useState\(0\);\n/g, '');
c = c.replace(/  const \[totalClientsCount, setTotalClientsCount\] = useState\(0\);\n/g, '');

// 3. Insert hook call after analyticsEvents state
c = c.replace(/  const \[analyticsEvents, setAnalyticsEvents\] = useState<AnalyticsEvent\[\]>\(\[\]\);\n/g, 
  "  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);\n" +
  "  const {\n" +
  "    confirmedAppointments,\n" +
  "    totalClientsCount,\n" +
  "    monthlyRevenue,\n" +
  "    prevMonthlyRevenue,\n" +
  "    returningThisWeek,\n" +
  "    monthlyStats,\n" +
  "    servicesByMonth,\n" +
  "    daysSinceLastAppointment,\n" +
  "    growthMetrics\n" +
  "  } = useDashboardMetrics(appointments, analyticsEvents);\n"
);

// 4. Remove useMemos
let current = c;
// Find start of growthMetrics = useMemo
let startIndex = current.indexOf('  const growthMetrics = useMemo(() => {');
if (startIndex !== -1) {
  let endIndex = current.indexOf('  }, [analyticsEvents, appointments]);\n', startIndex);
  if (endIndex !== -1) {
    let toReplace = current.substring(startIndex, endIndex + '  }, [analyticsEvents, appointments]);\n'.length);
    current = current.replace(toReplace, '');
  }
}

// Find confirmedAppointments
startIndex = current.indexOf('  const confirmedAppointments = useMemo(() =>');
if (startIndex !== -1) {
  let endIndex = current.indexOf('  );\n', startIndex);
  if (endIndex !== -1) {
    let toReplace = current.substring(startIndex, endIndex + '  );\n'.length);
    current = current.replace(toReplace, '');
  }
}

// Find monthlyStats
startIndex = current.indexOf('  const monthlyStats = useMemo(() => {');
if (startIndex !== -1) {
  let endIndex = current.indexOf('  }, [appointments]);\n', startIndex);
  if (endIndex !== -1) {
    let toReplace = current.substring(startIndex, endIndex + '  }, [appointments]);\n'.length);
    current = current.replace(toReplace, '');
  }
}

// Find servicesByMonth
startIndex = current.indexOf('  const servicesByMonth = useMemo(() => {');
if (startIndex !== -1) {
  let endIndex = current.indexOf('  }, [appointments]);\n', startIndex);
  if (endIndex !== -1) {
    let toReplace = current.substring(startIndex, endIndex + '  }, [appointments]);\n'.length);
    current = current.replace(toReplace, '');
  }
}

// Find daysSinceLastAppointment
startIndex = current.indexOf('  const daysSinceLastAppointment = useMemo(() => {');
if (startIndex !== -1) {
  let endIndex = current.indexOf('  }, [appointments]);\n', startIndex);
  if (endIndex !== -1) {
    let toReplace = current.substring(startIndex, endIndex + '  }, [appointments]);\n'.length);
    current = current.replace(toReplace, '');
  }
}

fs.writeFileSync('src/pages/Dashboard.tsx', current, 'utf8');

c = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// 5. Replace inside qAll
startIndex = c.indexOf('const clientMap = new Map();');
if (startIndex !== -1) {
  let endIndex = c.indexOf('setIsInitialLoading(false);', startIndex);
  if (endIndex !== -1) {
    let toReplace = c.substring(startIndex, endIndex);
    c = c.replace(toReplace, "setIsInitialLoading(false);\n      // Metrics calculation moved to useDashboardMetrics hook\n");
  }
}

fs.writeFileSync('src/pages/Dashboard.tsx', c, 'utf8');
console.log('done');
