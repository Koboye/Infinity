// University departments by college. Edit freely: the id is the stable key used in URLs and in the database.
// This is a broad starting catalogue; confirm the list against the departments (and exit-exam streams) at your target universities.
const C = (id, name, depts) => ({ id, name, depts: depts.map(([did, dname]) => ({ id: did, name: dname, college: id })) });

export const COLLEGES = [
  C('computing', 'Computing & Informatics', [
    ['computer-science', 'Computer Science'], ['information-technology', 'Information Technology'], ['information-systems', 'Information Systems'],
    ['software-engineering', 'Software Engineering'], ['information-science', 'Information Science'], ['data-science', 'Data Science'], ['cyber-security', 'Cyber Security'],
  ]),
  C('engineering', 'Engineering & Technology', [
    ['civil-engineering', 'Civil Engineering'], ['electrical-engineering', 'Electrical & Computer Engineering'], ['mechanical-engineering', 'Mechanical Engineering'],
    ['chemical-engineering', 'Chemical Engineering'], ['construction-management', 'Construction Technology & Management'], ['architecture', 'Architecture'],
    ['surveying', 'Surveying Engineering'], ['hydraulic-engineering', 'Hydraulic & Water Resources Engineering'], ['industrial-engineering', 'Industrial Engineering'],
    ['textile-engineering', 'Textile Engineering'], ['biomedical-engineering', 'Biomedical Engineering'],
  ]),
  C('business', 'Business & Economics', [
    ['accounting-finance', 'Accounting & Finance'], ['management', 'Management'], ['economics', 'Economics'], ['marketing-management', 'Marketing Management'],
    ['logistics-supply-chain', 'Logistics & Supply Chain Management'], ['banking-insurance', 'Banking & Insurance'], ['public-administration', 'Public Administration & Development Management'],
    ['hotel-tourism', 'Hotel & Tourism Management'], ['cooperatives', 'Cooperatives'],
  ]),
  C('health', 'Health Sciences', [
    ['medicine', 'Medicine'], ['nursing', 'Nursing'], ['midwifery', 'Midwifery'], ['pharmacy', 'Pharmacy'], ['public-health', 'Public Health'],
    ['medical-laboratory', 'Medical Laboratory Science'], ['anesthesia', 'Anesthesia'], ['health-informatics', 'Health Informatics'], ['dentistry', 'Dentistry'],
    ['environmental-health', 'Environmental Health'], ['radiography', 'Medical Radiology Technology'], ['optometry', 'Optometry'],
  ]),
  C('science', 'Natural & Computational Sciences', [
    ['mathematics', 'Mathematics'], ['physics', 'Physics'], ['chemistry', 'Chemistry'], ['biology', 'Biology'], ['statistics', 'Statistics'],
    ['geology', 'Geology'], ['sport-science', 'Sport Science'], ['biotechnology', 'Biotechnology'], ['meteorology', 'Meteorology'],
  ]),
  C('social', 'Social Sciences & Humanities', [
    ['law', 'Law'], ['sociology', 'Sociology'], ['psychology', 'Psychology'], ['political-science', 'Political Science & International Relations'],
    ['history', 'History & Heritage Management'], ['geography', 'Geography & Environmental Studies'], ['journalism', 'Journalism & Communication'],
    ['amharic', 'Amharic Language & Literature'], ['english', 'English Language & Literature'], ['civics', 'Civics & Ethical Education'],
    ['social-work', 'Social Work'], ['theatre-arts', 'Theatre Arts'], ['music', 'Music'],
  ]),
  C('agriculture', 'Agriculture & Natural Resources', [
    ['plant-science', 'Plant Science'], ['animal-science', 'Animal Science'], ['agricultural-economics', 'Agricultural Economics'], ['horticulture', 'Horticulture'],
    ['natural-resources', 'Natural Resource Management'], ['forestry', 'Forestry'], ['soil-water', 'Soil & Water Conservation'], ['food-science', 'Food Science & Post-Harvest Technology'],
    ['veterinary-medicine', 'Veterinary Medicine'],
  ]),
  C('education', 'Education & Behavioral Sciences', [
    ['educational-planning', 'Educational Planning & Management'], ['special-needs', 'Special Needs & Inclusive Education'], ['early-childhood', 'Early Childhood Education'],
    ['teacher-education', 'Teacher Education (Pedagogy)'],
  ]),
];

export const DEPARTMENTS = COLLEGES.flatMap((c) => c.depts);
const BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));
export const deptById = (id) => BY_ID.get(id) || null;
export const isDept = (id) => BY_ID.has(id);
